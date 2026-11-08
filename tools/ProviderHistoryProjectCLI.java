package ai.eva.android.probe;
import java.io.*;import org.json.*;
/** Offline migration of an explicitly supplied backup; never edits the source files. */
public final class ProviderHistoryProjectCLI {public static void main(String[] args)throws Exception{System.out.println(ProviderHistoryProjection.project(new File(args[0]),new File(args[1]),args[2],args[3],args[4],true).toString());}}
