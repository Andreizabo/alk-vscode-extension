# Alk Visual Studio Code Extension

Extension for the `Alk` programming language. Right now, the following features are present:
  * Recognition of files with the `.alk` extension
  * The option to directly run files with the `.alk` extension, with different options
  * The output is interpreted, any errors created will be shown directly on the code
  * Syntax highlighting
  * Auto-update and first install of the files needed to run `Alk`

## How to use:
  * In order to run an `Alk` file, you can press the run button in the top-right menu and choose the desired option (exhaustive or not).</br>
  ![run](/media/pics/runalk-menu.png)ics/runalk-menu.png)ics/runalk-menu.png)
  </br></br></br>
  * You can also run an `Alk` file by right clicking on the active editor and using the `Alk` submenu.<br>
  ![run](/media/pics/runalk-click.png)
  </br></br></br>
  * In order to stop a running program you can press the stop button in the top-right menu.<br>
  ![run](/media/pics/stop.png)
  </br></br></br>
  * Or right click on the active editor and use the option from the `Alk` submenu.<br>
  ![run](/media/pics/stop-click.png)
  </br></br></br>
  * The settings of `Alk` can be accessed using the `Alk Settings` options from the `Alk` submenu when right clicking.
  ![run](/media/pics/settings-click.png)
  * They can also be accessed by using the `Command Pallete` (default keybind `Ctrl+Shift+P`) and searching for `settings`. </br>
  ![run](/media/pics/settings.png)
  </br></br> Then searching for `alk` to easily find the options.</br>
  ![run](/media/pics/alk-settings.png)
  * The `Input` options allow the use as input of either of file or a configuration directly written in the interface. The `Input Active` option must be checked to use custom input.
  </br></br> To create input directly from the interface first the `text` option must be choosen in `Input Type`, and then key-value pairs can be added, removed and modified in the `Input Text` setting.</br>
  ![run](/media/pics/input-act.png)
  </br></br>To use a file as input first the `file` option must be choosen in `Input Type`, and then the name of the file must be entered in the `Input File` setting.</br>
  ![run](/media/pics/input-file.png)

  ## Useful links
  Read the [reference manual](https://github.com/alk-language/java-semantics/wiki/Reference-Manual) to review the Alk syntax.
  Also consider the [Alk-by example](https://github.com/alk-language/java-semantics/wiki/Alk-by-examples) wiki to understand how Alk behaves in real-scenarios.

  If you want to also run the `Alk` interpreter from the command line, it is strongly recommended to include the folder `Linux_Mac` or `Windows` in the PATH environment variable. 
  This allows you to call the the interpreter without mentioning the path to its location.
  
  ## Set Alk in PATH system variable
  Note that in the following instructions, ```[ALK-PATH]``` is a placeholder for the actual place where `Alk` is.

  In order to find the ```[ALK-PATH]``` needed below, you can run an `Alk` program through the extension with the `Show Command` option enabled from the setting, and you will see the full path to the `alki.sh` of `alki.bat` script.
  ![run](/media/pics/alk-line.png)
* Linux/Mac OS:
  ```
  export PATH=[ALK-PATH]/bin:$PATH
  ```
  Note that this will set the PATH only for the current shell. Opening another shell will not have Alk set in PATH. For the change to be persistent, use:
  ```
  echo 'PATH=[ALK-PATH]/bin:$PATH' >> ~/.bashrc
  ```
  To test if it works, the following command can be ran:
  ```
  alki.sh -h
  ```
* Windows
  * Search for ```Edit the system environment variables```
  * Open the ```System Properties``` window and press ```Environment variables...```
  * Select in the bottom grid (```System variables```) the ```Path``` variable and press ```Edit...```
  * Press ```New...```
  * For `Variable name` put `Alk`, and for `Variable value` put ```[ALK-PATH]```
  
  To test if it works, the following command can be ran:
  ```
  alki -h
  ```