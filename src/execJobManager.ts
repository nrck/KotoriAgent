import { EventEmitter } from 'events';
import { Common } from './common';
import { ExecJob } from './execJob';
import { SerialJobJSON } from './interface';

export class ExecJobManager {
    private _execJobs = new Array<ExecJob>();
    private _events: EventEmitter = new EventEmitter();

    public get execJobs(): ExecJob[] {
        return this._execJobs;
    }

    public set execJobs(value: ExecJob[]) {
        this._execJobs = value;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    /**
     * ExecJobの中からserialに一致するExecJobを返します。
     * @param serial 検索対象のシリアル番号
     */
    public findExecJob(serial: string, jobcode: string): ExecJob | undefined {
        return this.execJobs.find((execJob: ExecJob) => execJob.serial === serial && execJob.code === jobcode);
    }

    /**
     * ExecJobの中にserialに一致するExecJobが存在するか返します。
     * @param serial 検索対象のシリアル番号
     */
    public isExistExecJob(serial: string, jobcode: string): boolean {
        const execJob = this.findExecJob(serial, jobcode);

        return typeof execJob !== 'undefined';
    }

    /**
     * ジョブをリストに追加
     * @param serialJobJSON 受信したジョブ
     */
    public putExecJob(serialJobJSON: SerialJobJSON): boolean {
        // 既に同じserialのジョブが存在したら追加しない。
        if (this.isExistExecJob(serialJobJSON.serial, serialJobJSON.code)) {
            Common.trace(Common.STATE_ERROR, `シリアル：${serialJobJSON.serial}, ジョブコード${serialJobJSON.code}は既に実行中です。`);

            return false;
        }

        // ExecJobの作成
        const job = new ExecJob(serialJobJSON);

        // Eventはそのままパススルーするー（激寒）
        job.events.on(Common.EVENT_EXEC_ERROR, () => { this.onExecError(serialJobJSON); });
        job.events.on(Common.EVENT_EXEC_SUCCESS, (stdout: string, stderr: string) => { this.onExecSuccess(serialJobJSON, stdout, stderr); });
        job.events.on(Common.EVENT_EXEC_KILLED, () => { this.onExecKilled(serialJobJSON); });

        // リストに追加
        this.execJobs.push(job);

        return true;
    }

    /**
     * ジョブをリストから削除します。
     * @param serial 対象のシリアル番号
     */
    public delExecJob(serial: string): boolean {
        return this.execJobs.some((job: ExecJob, index: number) => {
            if (job.serial === serial) {
                this.execJobs.splice(index, 1);

                return true;
            } else {
                return false;
            }
        });
    }

    /**
     * 対象のジョブを実行します。
     * @param serial 対象のシリアル番号
     */
    public execJob(serial: string, jobcode: string): boolean {
        const job = this.findExecJob(serial, jobcode);
        if (typeof job === 'undefined') return false;
        job.exec();

        return true;
    }

    /**
     * 対象のジョブを強制終了します。
     * @param serial 対象のシリアル番号
     */
    public killJob(serial: string, jobcode: string): boolean {
        const job = this.findExecJob(serial, jobcode);
        if (typeof job === 'undefined') return false;
        job.kill();

        return true;
    }

    /**
     * ExecError発生時の処理です。
     * @param job 対象のジョブ
     */
    private onExecError(job: SerialJobJSON): void {
        Common.trace(Common.STATE_INFO, `シリアル：${job.serial}, ジョブコード${job.code}のError情報を送信します。`);
        Common.trace(Common.STATE_DEBUG, '====SerialJobJSONダンプ====');
        Common.trace(Common.STATE_DEBUG, JSON.stringify(job, undefined, '  '));
        Common.trace(Common.STATE_DEBUG, '====SerialJobJSONダンプ====');
        this.events.emit(Common.EVENT_EXEC_ERROR, job, (isSended: boolean) => {
            if (isSended) {
                Common.trace(Common.STATE_INFO, `シリアル：${job.serial}, ジョブコード${job.code}のError情報送信が受理されました。`);
                this.delExecJob(job.serial);
            } else {
                Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のError情報送信が受理されませんでした。`);
            }
        });
    }

    /**
     * ExecSuccess発生時の処理です。
     * @param job 対象のジョブ
     * @param stdout 標準出力
     * @param stderr エラー出力
     */
    private onExecSuccess(job: SerialJobJSON, stdout: string, stderr: string): void {
        Common.trace(Common.STATE_INFO, `シリアル：${job.serial}, ジョブコード${job.code}のSuccess情報を送信します。`);
        Common.trace(Common.STATE_DEBUG, '====SerialJobJSONダンプ====');
        Common.trace(Common.STATE_DEBUG, JSON.stringify(job, undefined, '  '));
        Common.trace(Common.STATE_DEBUG, '====SerialJobJSONダンプ====');
        this.events.emit(Common.EVENT_EXEC_SUCCESS, job, stdout, stderr, (isSended: boolean) => {
            if (isSended) {
                this.delExecJob(job.serial);
                Common.trace(Common.STATE_INFO, `シリアル：${job.serial}, ジョブコード${job.code}のSuccess情報送信が受理されました。`);
            } else {
                Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のSuccess情報送信が受理されませんでした。`);
            }
        });
    }

    /**
     * ExecKilled発生時の処理です。
     * @param job 対象のジョブ
     */
    private onExecKilled(job: SerialJobJSON): void {
        this.events.emit(Common.EVENT_EXEC_KILLED, job, (isSended: boolean) => {
            if (isSended) this.delExecJob(job.serial);
            else Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のKilled情報送信が受理されませんでした。`);
        });
    }
}
