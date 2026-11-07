import Core from "../../index.js";
import ModuleData from "./data.js";
import Authorization from "./authorization.js";
import WebSocket from "./websocket.js";
import TerminalCommandInit from "./terminal-commands/init.js";

import * as Twitch from "twitch.ts";
import axiosRetry from "axios-retry";
import axios from "axios";
import { EventEmitter } from "node:events";

interface TwitchModuleEvents {
	/** Calls after twitch access token validation */
	initialized: () => void;
}

export class TwitchModule extends EventEmitter {
	readonly name = "twitch" as const;
	readonly data: ModuleData;
	readonly log = Core.log.makeFunctions(this.name);

	readonly redirect_url = new URL("http://localhost:44026");
	readonly scopes: string[] = [
		"user:read:chat",
	];
	readonly authorization: Authorization = new Authorization();
	readonly ws: WebSocket = new WebSocket();

	constructor() {
		super();
		this.data = new ModuleData(this).initialize();
		TerminalCommandInit();
		if (this.data.disabled)
			return;

		Core.once("initialized", () => this.onAppInitialized());
	}

	isDisabled() {
		return this.data.disabled;
	}

	async fatalWithDisabling(msg: any, options?: Parameters<typeof this.log.fatal>[1]) {
		this.data.disabled = true;
		await this.data.save();
		return this.log.fatal(msg, options);
	}

	protected async onAppInitialized() {
		// init axios-retry
		axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });

		await this.data.checkRequiredFields();
		await this.authorization.validate();
		this.emit("initialized");

		/*this.ws.on("channel.chat.message", message => {
			const event = message.payload.event;
			this.log.info(`${event.chatter_user_name}: ${event.message.text}`, {args: event});
		});
		await this.ws.subscribeToEvent(Twitch.EventSub.ChannelChatMessage.RequestBody, {
			broadcaster_user_id: this.authorization.user_id,
			user_id: this.authorization.user_id,
		});*/
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

	getVODSavingTime(broadcasterType: Twitch.Helix.GetUsers.ResponseBody["data"][0]["broadcaster_type"]): number {
		switch(broadcasterType) {
			case "partner":   return 5184000000; // 60 days in ms
			case "affiliate": return 1209600000; // 14 days in ms
			case "":          return 604800000;  // 7 days in ms
		}
	}

	override once<EventName extends keyof TwitchModuleEvents>(eventName: EventName, listener: TwitchModuleEvents[EventName]) {
		return super.once(eventName, listener);
	}
	override prependOnceListener<EventName extends keyof TwitchModuleEvents>(eventName: EventName, listener: TwitchModuleEvents[EventName]) {
		return super.prependOnceListener(eventName, listener);
	}
	override on<EventName extends keyof TwitchModuleEvents>(eventName: EventName, listener: TwitchModuleEvents[EventName]) {
		return super.on(eventName, listener);
	}
	override prependListener<EventName extends keyof TwitchModuleEvents>(eventName: EventName, listener: TwitchModuleEvents[EventName]) {
		return super.prependListener(eventName, listener);
	}
	override off<EventName extends keyof TwitchModuleEvents>(eventName: EventName, listener: TwitchModuleEvents[EventName]) {
		return super.off(eventName, listener);
	}
	override emit<EventName extends keyof TwitchModuleEvents>(eventName: EventName, ...args: Parameters<TwitchModuleEvents[EventName]>) {
		return super.emit(eventName, ...args);
	}
}
export default new TwitchModule();