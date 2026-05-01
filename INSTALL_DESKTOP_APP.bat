@echo off
set SCRIPT="%TEMP%\%RANDOM%.vbs"
set ICON_PATH="C:\Users\MSI\Desktop\MakeWay\client\public\favicon.ico"
set TARGET="C:\Users\MSI\Desktop\MakeWay\LAUNCH_GIVEWAY.bat"

:: Create shortcut on standard Desktop
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = "%USERPROFILE%\Desktop\GiveWay ATES.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = %TARGET% >> %SCRIPT%
echo oLink.WorkingDirectory = "C:\Users\MSI\Desktop\MakeWay" >> %SCRIPT%
echo oLink.IconLocation = %ICON_PATH% >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

:: Create shortcut on OneDrive Desktop (just in case)
echo sLinkFile = "%USERPROFILE%\OneDrive\Desktop\GiveWay ATES.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = %TARGET% >> %SCRIPT%
echo oLink.WorkingDirectory = "C:\Users\MSI\Desktop\MakeWay" >> %SCRIPT%
echo oLink.IconLocation = %ICON_PATH% >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo ✅ Done! Please check your Desktop now.
pause
