param([ValidateSet('status','synthesize','transcribe')][string]$Action,[string]$InputFile,[string]$OutputFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
if($Action -eq 'status'){
 $recognizers=@([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | ForEach-Object {$_.Culture.Name})
 $speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
 try{$voices=@($speaker.GetInstalledVoices() | Where-Object {$_.Enabled} | ForEach-Object {$_.VoiceInfo.Culture.Name});@{recognizers=$recognizers;voices=$voices;localOnly=$true}|ConvertTo-Json -Compress}finally{$speaker.Dispose()}
 exit
}
if($Action -eq 'synthesize'){
 $speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
 try{$speaker.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet,[System.Speech.Synthesis.VoiceAge]::NotSet,0,[System.Globalization.CultureInfo]::GetCultureInfo('de-DE'));$speaker.SetOutputToWaveFile($OutputFile);$speaker.Speak([System.IO.File]::ReadAllText($InputFile,[System.Text.Encoding]::UTF8));$speaker.SetOutputToNull()}finally{$speaker.Dispose()}
 exit
}
$recognizer=New-Object System.Speech.Recognition.SpeechRecognitionEngine ([System.Globalization.CultureInfo]::GetCultureInfo('de-DE'))
try{
 $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
 $recognizer.SetInputToWaveFile($InputFile)
 $parts=New-Object System.Collections.Generic.List[string]
 while($true){
  try{$result=$recognizer.Recognize()}catch{if($recognizer.AudioState -eq [System.Speech.Recognition.AudioState]::Stopped -and $parts.Count -gt 0){break};throw}
  if($null -eq $result){break};$parts.Add($result.Text);if($parts.Count -ge 80){break}
 }
 [System.IO.File]::WriteAllText($OutputFile,($parts -join ' '),[System.Text.Encoding]::UTF8)
}finally{$recognizer.Dispose()}
