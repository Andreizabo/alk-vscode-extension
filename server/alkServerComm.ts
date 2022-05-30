import { EventEmitter } from "events";
import * as os from "os";

export class AlkServerComm extends EventEmitter
{
    private _childProcess: any;
    private _mainFile: string = '';
    private _alkOutput: string = '';
    private _alkOutputLines: string[] = [];
    private _commandOutput = new Map<string, string[][]>();

    public constructor()
    {
        super();
    }

    public async start(alkPath: string, mainFile: string): Promise<void>
    {
        this._mainFile = mainFile;
        let command = '', args = [];
        
        if (os.type() === 'Windows_NT')
        {
            command = alkPath;
            args = ['-a', `"${mainFile}"`, '-d', '-dm', /*options*/];
        }
        else
        {
            command = '/bin/bash';
            args = [`"${alkPath}"`, '-a', `"${mainFile}"`, '-d'];
        }
        const cp = require('child_process');
        this._childProcess = cp.spawn(command, args, {
            stdio: 'pipe'
        });
        this._childProcess.stdout.on('data', async (data: any) => {
            for (let c of data.toString())
            {
                this._alkOutput += c;
                if (c === '\n')
                {
                    this._alkOutputLines.push(this._alkOutput.slice());
                    this._alkOutput = '';
                }
            }
        });
        this._childProcess.stderr.on('data', (data: any) => {
            this.sendEvent('output', 'stderr', data.toString());
        });
        this._childProcess.on('close', (code: number) => {
            console.log(`child process exited with code ${code}`);
            this.sendEvent('end');
        });
        this._childProcess.on('error', (err: any) => {
            console.log(err);
        });
        this._alkOutputLines = [];
    }

    public terminate(): void
    {
        this._childProcess.kill();
    }

    private async writeCommand(command: string): Promise<string[]>
    {
        if (!this._childProcess)
        {
            console.log(`Tried to run ${command} but language server is not active`);
            return [];
        }
        this._childProcess.stdin.write(command);
        const trimmedCommand = command.trim();
        await this.waitForCommand(trimmedCommand);
        console.log(`Command: ${command}`);
        let commandOutputArray = this._commandOutput.get(trimmedCommand) || [['???']];
        const commandOutput = commandOutputArray[0];
        commandOutputArray.shift();

        console.log(`Command output: ${commandOutput}`);
        return commandOutput;
    }

    private sendEvent(event: string, ... args: any[]) 
    {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}

    private async waitForCommand(command: string): Promise<void>
    {
        await new Promise<void>(async resolve => {
            (function wait(output: Map<string, string[][]>, command: string)
            {
                if (output.has(command))
                {
                    let lines = output.get(command) || [];
                    if (lines.length > 0)
                    {
                        return resolve();
                    }
                }
                setTimeout(() => wait(output, command), 50);
            })(this._commandOutput, command);
        });
    }
}