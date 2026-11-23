import * as Core from "../../index.js";
import Authorization from "./authorization.js";
import WebSocket from "./websocket.js";
import TerminalCommandInit, { twitchInitName } from "./terminal-commands/init.js";

import * as Twitch from "twitch.ts";
import axiosRetry from "axios-retry";
import axios from "axios";
import { EventEmitter } from "node:events";

interface ModuleEvents {
	/** Calls after twitch access token validation */
	initialized: () => void;
}

export class Module extends EventEmitter implements Core.IModule {
	readonly name = "twitch" as const;
	readonly data: Data;
	readonly core: Core.Core;
	readonly log: Core.ModuleLogFunctions;

	readonly redirect_url = new URL("http://localhost:44026");
	readonly scopes: string[] = [];
	readonly authorization: Authorization = new Authorization();
	readonly ws: WebSocket = new WebSocket();

	constructor() {
		super();
		//throw new Error("nope.");

		TerminalCommandInit();
	}

	async load() {
		// init axios-retry
		axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });

		Core.default.modules.setReadonlyFields(this, {
			data: new Data(this),
			core: Core.default,
			log: Core.default.log.makeFunctions(this.name),
		});
		this.data.initialize();
	}

	async initialize() {
		if (this.data.disabled) return;
		await this.load();

		await this.data.checkRequiredFields();
		await this.authorization.validate();
		this.emit("initialized");
	}

	isDisabled() {
		return this.data.disabled;
	}

	async fatalWithDisabling(msg: any, options?: Parameters<typeof this.log.fatal>[1]) {
		this.data.disabled = true;
		await this.data.save();
		return this.log.fatal(msg, options);
	}

	translateToRU_gameName(gameName: string): string {
		switch(gameName) {
			case "": return "Без категории";
			case "Just Chatting": return "Общение";
			case "Games + Demos": return "Игры и Демо";
			case "Politics": return "Политика";
			case "Art": return "Искусство";
			case "Music": return "Музыка";
			case "DJs": return "Диджеи";
			case "Talk Shows & Podcasts": return "Ток-шоу и подкасты";
			case "Special Events": return "Мероприятия";
			case "Animals, Aquariums, and Zoos": return "Животные, аквариумы и зоопарки";
			default: return gameName;
		}
	}

	getVODSavingTime(broadcasterType?: Twitch.Helix.GetUsers.ResponseBody["data"][0]["broadcaster_type"]): number {
		switch(broadcasterType) {
			case "partner":   return 5184000000; // 60 days in ms
			case "affiliate": return 1209600000; // 14 days in ms
			default:          return 604800000;  // 7 days in ms
		}
	}

	override once<EventName extends keyof ModuleEvents>(eventName: EventName, listener: ModuleEvents[EventName]) {
		return super.once(eventName, listener);
	}
	override prependOnceListener<EventName extends keyof ModuleEvents>(eventName: EventName, listener: ModuleEvents[EventName]) {
		return super.prependOnceListener(eventName, listener);
	}
	override on<EventName extends keyof ModuleEvents>(eventName: EventName, listener: ModuleEvents[EventName]) {
		return super.on(eventName, listener);
	}
	override prependListener<EventName extends keyof ModuleEvents>(eventName: EventName, listener: ModuleEvents[EventName]) {
		return super.prependListener(eventName, listener);
	}
	override off<EventName extends keyof ModuleEvents>(eventName: EventName, listener: ModuleEvents[EventName]) {
		return super.off(eventName, listener);
	}
	override emit<EventName extends keyof ModuleEvents>(eventName: EventName, ...args: Parameters<ModuleEvents[EventName]>) {
		return super.emit(eventName, ...args);
	}
}

export class Data extends Core.BaseData {
	/** Module will disable itself on next app start, when fatal error will occure */
	disabled = false;
	/** If this `true`, next call of {@link save()} will save data */
	needsSave = false;

	protected module: Module;

	initialize() {
		const json = this.getSavedFields();
		this.needsSave = true;

		this.needsSave = !this.registerFieldMap(json, "authorization",
			savedValue => this.module.authorization.fromJSON(savedValue),
			() => this.module.authorization.toJSON(),
		);
		this.needsSave = !this.registerFieldBoolean(json, "disabled");

		this.save();
		return this;
	}

	async save(force?: boolean) {
		if (force || this.needsSave) {
			await super.save();
			this.needsSave = false;
		}
	}

	async checkRequiredFields() {
		if (this.module.authorization.refresh_token.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.refresh is expected as non-empty string`});
		if (this.module.authorization.client_id.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.id is expected as non-empty string`});
		if (this.module.authorization.client_secret.length < 1)
			await this.module.fatalWithDisabling(`Saved data is malformed, please initialize module with "node index.js ${twitchInitName}"`, {error: `authorization.secret is expected as non-empty string`});
	}
}

export default new Module();