Unicode true
!include LogicLib.nsh
!include FileFunc.nsh
!addplugindir "${TEST_PLUGIN_DIR}"
!include "${TEST_VERSION_HOOK}"
Name "Dream Builder version comparison test"
OutFile "${TEST_OUTPUT}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true

!macro AssertVersion CURRENT INSTALLED EXPECTED CODE
  !insertmacro DreamBuilderCompareInstalledVersion "${CURRENT}" "${INSTALLED}" $R0
  ${If} $R0 != ${EXPECTED}
    SetErrorLevel ${CODE}
    Quit
  ${EndIf}
!macroend

Section
  ${GetParameters} $R9
  ${If} $R9 == "/downgrade"
    !insertmacro DreamBuilderEnforceInstalledVersion "1.0.0" "1.1" "false" "Invalid installed version" "Downgrades are disabled"
    SetErrorLevel 31
    Quit
  ${ElseIf} $R9 == "/invalid"
    !insertmacro DreamBuilderEnforceInstalledVersion "1.0.0" "unknown" "false" "Invalid installed version" "Downgrades are disabled"
    SetErrorLevel 32
    Quit
  ${ElseIf} $R9 == "/upgrade"
    !insertmacro DreamBuilderEnforceInstalledVersion "1.1.0" "1.0" "false" "Invalid installed version" "Downgrades are disabled"
    SetErrorLevel 0
    Quit
  ${ElseIf} $R9 == "/reinstall"
    !insertmacro DreamBuilderEnforceInstalledVersion "1.0.0" "1.0" "false" "Invalid installed version" "Downgrades are disabled"
    SetErrorLevel 0
    Quit
  ${EndIf}
  !insertmacro AssertVersion "1.0.0" "1.0" 0 11
  !insertmacro AssertVersion "1.1.0" "1.0" 1 12
  !insertmacro AssertVersion "1.0.0" "1.1" -1 13
  !insertmacro AssertVersion "1.0.0" "1.0.0" 0 14
  !insertmacro AssertVersion "1.10.0" "1.9" 1 15
  !insertmacro AssertVersion "1.0.0" "unknown" 2 16
  !insertmacro AssertVersion "1.0.0" "1." 2 17
  !insertmacro AssertVersion "1.0.0" "01.0" 2 18
  !insertmacro AssertVersion "1.0.0" "" 2 19
  !insertmacro AssertVersion "1.0.0" "1.0.0.0" 2 20
  !insertmacro AssertVersion "0.0.0" "0.0" 0 21
  !insertmacro AssertVersion "1.0.0" "1.0-beta" 2 22
  SetErrorLevel 0
SectionEnd
