# Alk Visual Studio Code Extension

## Română

Extensie pentru limbajul Alk. În acest moment are următoarele feature-uri:
  * Recunoașterea fișierelor cu extensia `.alk`
  * Opțiunea de a rula direct fișiere cu extensia `.alk`, cu diferite opțiuni
  * Output-ul este interpretat, afișând direct pe cod erorile create
  * Syntax highlighting

### Cum se folosește:
  * Pentru a rula un fisier cu cod de `Alk`, se poate apăsa pe butonul de run din meniul din dreapta sus, și apoi selectată opțiunea dorită.</br>
  ![run](/media/pics/runalk-menu.png)
  </br></br></br>
  * O altă metodă de a rula un astfel de fișier este să se apese click dreapta, și
  să se folosească meniul de `Alk` care apare.</br>
  ![run](/media/pics/runalk-click.png)
  </br></br></br>
  * Pentru a opri execuția unui program deja pornit, se poate apăsa pe butonul din meniul din dreapta sus.</br>
  ![run](/media/pics/stop.png)
  </br></br></br>
  * O altă metodă de a opri un program pornit este să se apese click dreapta, și
  să se folosească din meniul de `Alk` opțiunea `Stop Alk`.</br>
  ![run](/media/pics/stop-click.png)
  </br></br></br>
  * Pentru a modifica setările pentru `Alk` ne folosim de `Command Palette` (Se deschide standard cu `Ctrl+Shift+P`). Aici se dă search după `settings`.</br>
  ![run](/media/pics/settings.png)
  </br></br>Apoi căutăm `alk` și ne vor apărea setările pentru `Alk`.</br>
  ![run](/media/pics/alk-settings.png)
  </br></br></br>
  * Anumite setări care se vor schimba mai des sunt puse în 
  tabul de `ALK OPTIONS`.</br>
  ![run](/media/pics/alk-opt.png)
  </br></br></br>
  * Aici avem opțiunea de `Input`. Se poate selecta pentru `Input` fie un fișier, 
  fie se pot introduce direct variabile și valorile lor.</br>
  ![run](/media/pics/input.png)
  </br></br>Butonul `Add` va adăuga o nouă pereche de tipul `(variabila |-> valoare)`, iar butonul `Remove` o va șterge.</br>
  ![run](/media/pics/input-act.png)
  </br></br>Butonul `Save` va salva input-ul creat într-un fișier. Va trebui introdus numele fișierului în prompt-ul care va apărea în partea de sus a ecranului.</br>
  ![run](/media/pics/save-input.png)
  </br></br>Acum putem alege fișierul creat, sau alt fișier, ca și input în loc să folosim perechi create in interfață.</br>
  ![run](/media/pics/input-file.png)

  Puteți citi [manualul de referinta](https://github.com/alk-language/java-semantics/wiki/Reference-Manual) pentru a vă familiariza cu sintaxa `Alk`.
  De asemenea puteți citi wiki-ul [Alk-by example](https://github.com/alk-language/java-semantics/wiki/Alk-by-examples) pentru a înțelege cum se poate utiliza `Alk` într-un context real.

  Dacă doriți șa rulați interpretorul `Alk` și de la linia de comanda, este recomandat să includeți folder-ul `Linux_Mac` sau `Windows` în variabila de mediu PATH. 
  Astfel veți putea apela interpretorul `Alk` fără a specifica calea completă către acesta.

### Adăugare `Alk` la PATH
În cele ce urmează ```[ALK-PATH]``` va fi un placeholder pentru locația unde se află `Alk-ul`. Pentru a găsi path-ul pentru `Alk` se poate rula un program `Alk` cu opțiunea `Show command` pornită. Path-ul complet va apărea în consolă.
![run](/media/pics/alk-line.png)
* Linux/Mac OS:
  ```
  export PATH=[ALK-PATH]/bin:$PATH
  ```
  Asta va seta PATH-ul doar pentru shell-ul curent. Dacă alt shell va fi deschis el nu va avea `Alk` setat in PATH. Pentru a rămâne setat global, trebuie folosit:
  ```
  echo 'PATH=[ALK-PATH]/bin:$PATH' >> ~/.bashrc
  ```
  
  Se testează dacă merge cu:
  ```
  alki.sh -h
  ```
  
* Windows
  * Se dă search după ```Edit the system environment variables```
  * Se deschide fereastra ```System Properties``` și se apasă pe ```Environment variables...```
  * Se selectează din tabelul de jos (```System variables```) variabila ```Path``` și se apasă pe ```Edit...```
  * Se apasă pe ```New...``` 
  * La `Variable name` se pune `Alk`, iar la `Variable value` se pune ```[ALK-PATH]```

  Se testează dacă merge cu:
  ```
  alki -h
  ```

## English

Extension for the Alk programming language. Right now, the following features are present:
  * Recognition of files with the `.alk` extension
  * The option to directly run files with the `.alk` extension, with different options
  * The output is interpreted, any errors created will be shown directly on the code
  * Syntax highlighting

### How to use:
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
  * The settings of `Alk` can be changed by using the `Command Pallete` (default keybind `Ctrl+Shift+P`) and searching for `settings`. </br>
  ![run](/media/pics/settings.png)
  </br></br> Then we search for `alk` to easily find the options.</br>
  ![run](/media/pics/alk-settings.png)
  * The options that change most frequently are chaged from the `ALK OPTIONS` tab.</br>
  ![run](/media/pics/alk-opt.png)
  </br></br></br>
  * Here we have the `Input` option. We can get the input form eiter a file, or by directly writing it in the interface.
  ![run](/media/pics/input.png)
  </br></br> The `Add` button adds a new `(name |-> value)` and the `Remove` button removes it.<br>
  ![run](/media/pics/input-act.png)
  </br></br> The `Save` button saves input from the interface in a file in the current directory. You will have to enter the file's name in the prompt from the top of the screen.</br>
  ![run](/media/pics/save-input.png)
  </br></br>Now we can choose the created file, or any file, as input instead of using pairs defined in the interface.</br>
  ![run](/media/pics/input-file.png)

  Read the [reference manual](https://github.com/alk-language/java-semantics/wiki/Reference-Manual) to review the Alk syntax.
  Also consider the [Alk-by example](https://github.com/alk-language/java-semantics/wiki/Alk-by-examples) wiki to understand how Alk behaves in real-scenarios.

  If you want to also run the `Alk` interpreter from the command line, it is strongly recommended to include the folder `Linux_Mac` or `Windows` in the PATH environment variable. 
  This allows you to call the the interpreter without mentioning the path to its location.
  
  ### Set Alk in PATH system variable
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