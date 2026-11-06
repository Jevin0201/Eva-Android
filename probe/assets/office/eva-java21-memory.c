/* Eva's process-local compatibility adapter for OpenJDK 21 on Android/PRoot.
 * A probe page can merge with the current pthread stack VMA. SELinux then
 * rejects making that entire VMA executable before mprotect splits the page.
 * Split the page first and retry the identical protection request. The kernel
 * continues to enforce permissions. No JVM check or syscall error is suppressed.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/syscall.h>
#include <unistd.h>

/* Only an anonymous private page with known dump flags is eligible. */
static int page_dump_state(void *address, size_t size) {
    FILE *maps = fopen("/proc/self/smaps", "r");
    if (!maps) return -1;
    char line[2048], permissions[5];
    unsigned long start, end, offset, inode;
    unsigned int major, minor;
    int selected = 0, result = -1;
    while (fgets(line, sizeof(line), maps)) {
        if (sscanf(line, "%lx-%lx %4s %lx %x:%x %lu",
                   &start, &end, permissions, &offset, &major, &minor, &inode) == 7) {
            selected = (uintptr_t)address >= start &&
                       (uintptr_t)address + size <= end &&
                       strcmp(permissions, "rw-p") == 0 && inode == 0;
        } else if (selected && strncmp(line, "VmFlags:", 8) == 0) {
            result = strstr(line, " dd ") || strstr(line, " dd\n") ? 1 : 0;
            break;
        }
    }
    fclose(maps);
    return result;
}

int mprotect(void *address, size_t size, int protection) {
    int incoming_errno = errno;
    int result = syscall(SYS_mprotect, address, size, protection);
    int failure_errno = errno;
    if (result == 0 || failure_errno != EACCES ||
        size != (size_t)sysconf(_SC_PAGESIZE) ||
        protection != (PROT_READ | PROT_WRITE | PROT_EXEC)) {
        errno = failure_errno;
        return result;
    }

    Dl_info caller;
    const char *enabled = getenv("EVA_JAVA21_COMPAT");
    if (!enabled || strcmp(enabled, "1") != 0 ||
        !dladdr(__builtin_return_address(0), &caller) || !caller.dli_fname ||
        !strstr(caller.dli_fname, "/java-21-openjdk/lib/server/libjvm.so")) {
        errno = failure_errno;
        return result;
    }

    /* Never turn a page actually containing this call's stack into code. */
    uintptr_t stack = (uintptr_t)&caller;
    if (stack >= (uintptr_t)address && stack < (uintptr_t)address + size) {
        errno = failure_errno;
        return result;
    }
    int dump_state = page_dump_state(address, size);
    if (dump_state != 0 || madvise(address, size, MADV_DONTDUMP) != 0) {
        errno = failure_errno;
        return result;
    }

    result = syscall(SYS_mprotect, address, size, protection);
    int retry_errno = errno;
    int restored = madvise(address, size, MADV_DODUMP);
    if (getenv("EVA_JAVA21_COMPAT_TRACE")) {
        fprintf(stderr, "Eva Java21 probe isolation: mprotect=%d dump_restore=%d\n",
                result, restored);
    }
    /* A failed restoration leaves this page excluded from dumps until unmap. */
    errno = result == 0 ? incoming_errno : retry_errno;
    return result;
}
