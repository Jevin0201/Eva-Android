from pathlib import Path
p=Path('probe/src/PhoneSelfCheck.java');s=p.read_text(encoding='utf-8').replace('.optString(key).equals(value)', '.optString(key).equalsIgnoreCase(value)');p.write_text(s,encoding='utf-8')
p=Path('probe/src/PhoneFixtureActivity.java');s=p.read_text(encoding='utf-8').replace('button.setText("fixture-click");','button.setAllCaps(false);button.setText("fixture-click");');p.write_text(s,encoding='utf-8')
