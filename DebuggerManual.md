# Alk Debugger

## Glossary

*  <strong>Statement</strong> = an instruction on which the execution can be stopped. (Assignments, loops, choose, continue, return, etc.).
*  <strong>Debug step</strong> = a step to the next statement.
*  <strong>Callstack</strong> = a data structure that stores all the function calls that are running at a specific moment.
*  <strong>Brakpoint</strong> = an indicator which tells the debugger to stop the execution at a certain line.
*  <strong>Nondeterministic statement</strong> = a statement which will produce a different result each time it is ran. Refers to either `choose` or `uniform`.
*  <strong>Execution branch</strong> = one of the possible executions which are created when a nondeterministic statement is executed.
*  <strong>Checkpoint</strong> = a point in the code execution timeline to which the user can later return to.

***

## Commands

### Command syntax

A command is a single line of input, having the following syntax:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>command [\<arg_1\>] [\<arg_2\>] ... [\<arg_n\>]</em><br><br>
When defining the syntax of a command, the following conventions apply:
*  \<argument\> &ndash; This is a required argument. The command will not execute if it is missing.
*  [\<argument\>] &ndash; This is an optional argument. The command will usually have a different behaviour if the argument is missing.
<br><br>
### Implemented commands
***
### <strong><span style="color:lightblue">help</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>help [\<command\>]</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Prints the usage and description of the command given as argument, or of all the commands if no argument is given.

***
### <strong><span style="color:lightblue">run</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>run</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Continues the execution to the end of the program.

***
### <strong><span style="color:lightblue">continue</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>continue</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Continues the execution until encountering a breakpoint.

***
### <strong><span style="color:lightblue">step</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>step</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Executes a debug step. 

***
### <strong><span style="color:lightblue">next</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>next</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Executes a succession of debug steps until the execution reaches a level lower or equal in the callstack.

***
### <strong><span style="color:lightblue">backtrace</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>backtrace</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Prints the callstack.

***
### <strong><span style="color:lightblue">print</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>print \<expression\></em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Evaluates an expression in the context of the current execution and prints the result.

***
### <strong><span style="color:lightblue">break</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>break \<line_number\></em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Creates a breakpoint at the specified line.

***
### <strong><span style="color:lightblue">breakpoints</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>breakpoints</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Prints all the breakpoints that are currently active.

***
### <strong><span style="color:lightblue">clear</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>clear [\<line_number\>]</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Deletes the breakpoint at the specified line, or all of them if no argument is given.

***
### <strong><span style="color:lightblue">back</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>back</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Goes back in the execution to a previous checkpoint. You will be prompted to input the checkpoint to return to after executing the command.

***
### <strong><span style="color:lightblue">checkpoints</span></strong>
Usage:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>checkpoints</em><br>
Description:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Prints all the checkpoints that are currently active.

***

## Stopping and continuing the execution

The main purpose of a debugger is to allow the user to stop the execution of a program at certain points, in order to investigate problems or simply observe the state of the execution.<br><br>

In the context of the <strong>Alk Debugger</strong>, the execution may stop when encountering a breakpoint or a nondeterministic statement.<br><br>

### <strong><span style="color:lightblue">Breakpoints</span></strong>

A `breakpoint` is an indicator which tells the debugger to stop the execution at a certain line. They can be created using the `break` command, and can be deleted using the `clear` command. The command `breakpoints` will print all the breakpoints that are currently active.

### <strong><span style="color:lightblue">Nondeterministic statements</span></strong>

A `nondeterministic statement` refers to statement that, if ran multiple times, will produce different results. Such statements are `choose` and `uniform`. 

When the debugger encounters one of them, the execution will stop and the user will be prompted to choose an execution branch to continue with.
Each time such a choice is prompted, a checkpoint is saved.

The user can always go back to a checkpoint using the `back` command. The command `checkpoints` will print all the checkpoints that are currently active.

***

### <strong><span style="color:lightblue">Run and Continue</span></strong>

Both `run` and `continue` commands will restart the execution of the program.
*  `run` will continue the execution until the end of the program, not longer stopping at breakpoints and nondeterministic statements. It's the equivalent of continuing the execution without a debugger.
*  `continue` will continue the execution until encountering a breakpoint or a nondeterministic statement, at which point the execution will once again stop.

### <strong><span style="color:lightblue">Step and Next</span></strong>

`step` is a command which will advance the execution of the program until encountering an instruction on which it can be stopped (Assignments, loops, choose, continue, return, etc.).

`next` is a command which will execute a succession of debug steps, until execution reaches a level lower or equal in the callstack.

Thus, one key difference between `step` and `next` is that, when encountering a function call, `step` will enter the function, effectively debugging its code, whilst `next` will just skip it altogether and move on to the next instruction, receiving the result of the function call directly without debugging its code.

***

## Examining the stack

Each time a function call is encountered throughout the execution some information about that call is generated and stored in the `callstack`.
Each entry in this stack stores the name of the function called, its parameters' names and the value of those parameters for that certain call.

In order to see the current callstack, the `backtrace` command can be used.

***

## Altering the execution

As seen in the `"Stopping and continuing the execution"` section, some statements require user interaction while debugging, thus allowing the alteration of the execution.

Nondeterministic statements generate multiple execution branches when ran, and while debugging the program the user must choose themselves on which one of those branches they want to continue debugging. Each of those choices will, besides deciding the value of the nondeterministic variable, create a checkpoint (by cloning the state of the execution at the moment before the choice is made). 

If, at any time, the user decides that the choice they made should be reverted they can simply use the command `back`. This will present the user with a list of all the existing checkpoints, and prompt them to choose to which one of them to return. After choosing, the state of the execution will revert back to what it was at the moment that checkpoint was created, allowing the user to choose again the execution branch on which to continue debugging.

The command `checkpoints` is similar to `back`, it printing all the active checkpoints, the main difference being that it does not propmt the user to choose one of them to revert back to.

***

## Examining data

While debugging, the user will usually want to check if the value of certain variables matches what they expect. This operation can be done at any time using the `print` command.

The `print` command takes exactly one argument, which can either be a simple variable, or a more complex expression which will be evaluated in the current context; it will then print the value of the argument.