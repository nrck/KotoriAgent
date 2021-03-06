import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as SocketIOClient from 'socket.io-client';
import { Common } from './common';
import { AgentJSON, DataHeaderJSON, SendJobJSON, SerialJobJSON } from './interface';

export class ClientManager {
    private static CLIENT_CONFIG = './config/agent.json';
    private static CLIENT_PROTOCOL = 'ws';

    private _socket: SocketIOClient.Socket;
    private _serverHost: string;
    private _port: number;
    private _namespace: string;
    private _agentName = '';
    private _shareKey = '';
    private _agentIP = '';
    private _events: EventEmitter;
    private _no: number;

    /**
     * クライアントマネージャーを作成します。
     * @param serverHost PoplarServerのホスト、またはIPアドレスを指定します。
     * @param port 接続ポートを指定します。
     * @param namespace 接続ネームスペースを指定します。デフォルトで"/"になります。
     * @param no パケットNo
     */
    constructor(serverHost: string, port: number, namespace?: string, no?: number) {
        this._serverHost = serverHost;
        this._port = port;
        this._events = new EventEmitter();
        this._namespace = namespace || '/';
        this._socket = SocketIOClient(`${ClientManager.CLIENT_PROTOCOL}://${this.serverHost}:${this.port}${this.namespace}`, { 'autoConnect': false });
        this._no = no || 0;
        this.setAgentInfo();
        this.initClient();
    }


    public get agentName(): string {
        return this._agentName;
    }

    public get shareKey(): string {
        return this._shareKey;
    }

    public get agentIP(): string {
        return this._agentIP;
    }

    public get serverHost(): string {
        return this._serverHost;
    }

    public get port(): number {
        return this._port;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    public get socket(): SocketIOClient.Socket {
        return this._socket;
    }

    public get namespace(): string {
        return this._namespace;
    }

    public get connected(): boolean {
        return this.socket.connected;
    }

    public get no(): number {
        this._no++;

        return this._no;
    }

    public setAgentInfo(): void {
        const file = JSON.parse(fs.readFileSync(ClientManager.CLIENT_CONFIG, 'utf8'));
        this._agentName = file.agentName;
        this._agentIP = file.ip;
        this._shareKey = file.sharekey;
    }

    /**
     * 初期化します
     */
    public initClient(): void {
        // 接続時
        this.socket.on('connect', () => { this.connection(); });
        // 切断時
        this.socket.on(Common.EVENT_DISCONNECT, (reason: string) => { this.disconnect(reason); });
        // ジョブ強制終了の受信
        this.socket.on(Common.EVENT_KILL_JOB, (data: SendJobJSON, ack: Function) => { this.receiveKillJob(data, ack); });
        // ジョブ実行の受信
        this.socket.on(Common.EVENT_SEND_JOB, (data: SendJobJSON, ack: Function) => { this.receiveJob(data, ack); });
    }

    /**
     * ソケットを開きます。
     */
    public open(): void {
        if (this.socket.connected) return;
        this.socket.open();
        Common.trace(Common.STATE_INFO, `ws://${this.serverHost}:${this.port}${this.namespace}に接続を開始しました。`);
    }

    /**
     * クローズします。
     */
    public close(): void {
        if (this.socket.disconnected) return;
        this.socket.close();
        Common.trace(Common.STATE_INFO, `ws://${this.serverHost}:${this.port}${this.namespace}を切断しました。`);
        this.socket.removeAllListeners();
    }

    /**
     * コネクション接続時。
     */
    private connection(): void {
        // ログ
        Common.trace(Common.STATE_INFO, `${this.socket.io.uri}に接続しました。`);
        const data: AgentJSON = {
            'ipaddress': this.agentIP,
            'name': this.agentName,
            'sharekey': this.shareKey
        };
        this.socket.emit(Common.EVENT_HELLO, { 'data': data, 'header': this.createDataHeader(false, Common.EVENT_HELLO) }, (isSuccess: boolean) => {
            if (isSuccess) {
                Common.trace(Common.STATE_INFO, 'サーバ認証に成功しました。');
            } else {
                Common.trace(Common.STATE_ERROR, `サーバ認証に失敗したため、${this.socket.io.uri}を切断します。`);
                this.close();
            }
        });
    }

    /**
     * 切断時にイベント発火し、Appへ通知します。
     * @param reason 切断理由
     */
    private disconnect(reason: string): void {
        Common.trace(Common.STATE_INFO, `${reason}のため、${this.socket.io.uri}から切断されました。`);
    }

    /**
     * ジョブ受信時の処理です。
     * @param data 受信したSendJobJSON
     * @param ack サーバーへ返答するFunction（true|false）
     */
    private receiveJob(data: SendJobJSON, ack: Function): void {
        Common.trace(Common.STATE_INFO, `${data.header.from}から${data.header.to}へのシリアル${data.data.serial}、ジョブコード${data.data.code}のジョブ情報を受信しました。`);
        // 自分宛てか確認する
        if (this.isDestinationToMyself(data.header)) {
            this.events.emit(Common.EVENT_RECEIVE_SEND_JOB, data.data, ack);
        } else {
            Common.trace(Common.STATE_ERROR, `${data.header.from}から${data.header.to}へのシリアル${data.data.serial}、ジョブコード${data.data.code}のジョブ情報は自エージェント宛ではありません。`);
            ack(false);
        }
    }

    /**
     * ジョブ強制終了受信時の処理です。
     * @param data 受信したSendJobJSON
     * @param ack サーバーへ返答するFunction（true|false）
     */
    private receiveKillJob(data: SendJobJSON, ack: Function): void {
        Common.trace(Common.STATE_INFO, `${data.header.from}から${data.header.to}へのシリアル${data.data.serial}、ジョブコード${data.data.code}のジョブ情報を受信しました。`);
        // 自分宛てか確認する
        if (this.isDestinationToMyself(data.header)) {
            this.events.emit(Common.EVENT_RECEIVE_KILL_JOB, data.data, ack);
        } else {
            Common.trace(Common.STATE_ERROR, `${data.header.from}から${data.header.to}へのシリアル${data.data.serial}、ジョブコード${data.data.code}のジョブ情報は自エージェント宛ではありません。`);
            ack(false);
        }
    }

    /**
     * データヘッダーを作成します。
     * @param isResponse 返信かどうか
     * @param to 宛先
     * @param type データ・タイプ
     */
    private createDataHeader(isResponse: false | [true, number], type: string): DataHeaderJSON {
        const header: DataHeaderJSON = {
            'from': this.agentName,
            'isResponse': isResponse,
            'no': this.no,
            'timestamp': new Date(),
            'to': Common.ENV_SERVER_HOST,
            'type': type
        };

        return header;
    }

    /**
     * 自分宛てかどうか確認します。
     * @param header 受信したデータヘッダー
     */
    private isDestinationToMyself(header: DataHeaderJSON): boolean {
        return header.to === this.agentName;
    }

    /**
     * データヘッダーを付加してメッセージを送付します。
     * @param serialJob シリアルジョブ
     * @param eventType イベントタイプ
     * @param onAck Ack
     */
    public putDataHeaderAndSendJob(serialJob: SerialJobJSON, eventType: string, onAck: Function): void {
        // eventTypeの確認
        switch (eventType) {
            case Common.EVENT_EXEC_ERROR:
            case Common.EVENT_EXEC_KILLED:
            case Common.EVENT_EXEC_SUCCESS:
                eventType = Common.EVENT_SEND_JOB_RESULT;
                break;
            default:
                Common.trace(Common.STATE_ERROR, `putDataHeaderAndSendJobで未定義のイベントが引数に渡されました。eventType=${eventType}`);

                return;
        }

        // SendJobJSONの作成
        const sendJobJSON: SendJobJSON = {
            'data': serialJob,
            'header': this.createDataHeader(false, eventType)
        };

        Common.trace(Common.STATE_INFO, `サーバにタイプ${eventType}、シリアル${sendJobJSON.data.serial}、ジョブコード${sendJobJSON.data.code}を送信しました。`);
        this.socket.emit(eventType, sendJobJSON, onAck);
    }
}

