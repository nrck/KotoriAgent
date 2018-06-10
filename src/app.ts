import { ClientManager } from './clientManager';
import { Common } from './common';
import { ExecJob } from './execJob';

class App {
    private execJobs = new Array<ExecJob>();
    private cm: ClientManager;

    constructor() {
        // tslint:disable-next-line:no-magic-numbers
        this.cm = new ClientManager('192.168.2.2', 27131);
    }

    public start(): void {
        this.cm.open();
    }

    public stop(): void {
        this.cm.close();
    }

}
try {
    const app = new App();
    app.start();
} catch (error) {
    Common.trace(Common.STATE_ERROR, error.stack);
}
