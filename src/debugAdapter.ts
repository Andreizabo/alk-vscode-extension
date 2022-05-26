import { AlkDebugSession } from './alkDebug';
import * as os from "os";

// start a single session that communicates via stdin/stdout
const session = new AlkDebugSession(os.type() === 'Windows_NT' ? 'alki.bat' : 'alki.sh');
process.on('SIGTERM', () => {
    session.shutdown();
});
session.start(process.stdin, process.stdout);
