import Core from "../../index.js";
import ModuleData from "./data.js";
import EventSubController from "./eventsub.js";
import TerminalCommandInit from "./terminal-commands/init.js";

import { Authorization, ResponseBody, Request, Options } from "twitch.ts";
import { EventEmitter } from "node:events";

interface TwitchModuleEvents {
	/** Calls after twitch access token validation */
	tokenValidated: () => void;
}

class TwitchModule extends EventEmitter {
	readonly name = "twitch" as const;
	readonly data: ModuleData;
	readonly log = Core.log.makeFunctions(this.name);

	readonly redirectPort = 44026 as const;
	readonly redirectURL = `http://localhost:${this.redirectPort}` as const;
	readonly scopes: Authorization.Scope[] = [];

	readonly authorization: Authorization.User<typeof this.scopes> = {
		token: "",
		client_id: "",
		scopes: [],
		expires_in: 0,
		user_id: "",
		user_login: "",
		type: "user"
	};
	readonly eventSub = EventSubController;

	constructor() {
		super();
		Options.setTwitchCLIMode(true);

		this.data = new ModuleData(this).initialize();
		TerminalCommandInit();

		Core.once("initialized", () => this.onAppInitialized());
	}

	protected onAppInitialized() {
		this.data.checkRequiredFields();
		this.validateToken().then(() => this.emit("tokenValidated"));
	}

	async refreshToken() {
		const response = Options.twitchCLIMode ? await Request.OAuth2Token.UserToken(this.data.clientID, this.data.clientSecret, "", this.scopes) : await Request.OAuth2Token.RefreshToken(this.data.clientID, this.data.clientSecret, this.data.refreshToken);
		if (!response.ok) {
			if (response.status === 408) {
				await new Promise(r => setTimeout(r, 1000));
				await this.refreshToken();
				return;
			}

			return this.log.fatal("Refreshing access token failed", {args: {
				status: response.status,
				message: response.message
			}});
		}

		this.authorization.token = response.access_token;
		this.authorization.expires_in = response.expires_in;
		this.data.refreshToken = response.refresh_token;
		this.data.accessToken = response.access_token;
		this.data.save();
		this.log.info("Access token was refreshed", {args: {
			refreshToken: response.refresh_token,
			accessToken: response.access_token,
			expiresIn: new Date(Date.now() + response.expires_in * 1000).toUTCString()
		}});
	}

	async validateToken() {
		if (Options.twitchCLIMode) {
			await this.refreshToken();
			this.authorization.client_id = this.data.clientID;
			return;
		}

		const response = await Request.OAuth2Validate(this.data.accessToken);
		if (!response.ok) {
			if (response.status === 401) {
				await this.refreshToken();
				await this.validateToken();
				return;
			}

			this.log.fatal("Validating access token failed", {args: {
				status: response.status,
				message: response.message
			}});
			return;
		}

		if (response.type === "app") {
			this.log.fatal("Access token is not user access token");
			return;
		}

		this.authorization.token = response.token;
		this.authorization.expires_in = response.expires_in;
		this.authorization.client_id = response.client_id;
		this.authorization.scopes = response.scopes;
		this.authorization.type = response.type;
		this.authorization.user_id = response.user_id;
		this.authorization.user_login = response.user_login;
	}

	async runRequestWithTokenRefreshing<R extends ResponseBody.Base<true, number>, A extends any[]>(request: (...args: A)=>Promise<R | ResponseBody.Error>, ...args: A): Promise<R | ResponseBody.Error> {
		return await new Promise(async(resolve) => {
			while(true) {
				const r = await request(...args);
				if (r.ok) return resolve(r);
				else if (r.status === 401) await this.refreshToken();
				else if (r.status !== 408) return resolve(r);

				await new Promise(resolve2 => setTimeout(resolve2, 1000));
			}
		});
	}

	async runRequestWithTokenRefreshingWithoutError<R extends ResponseBody.Base<true, number>, A extends any[]>(request: (...args: A)=>Promise<R | ResponseBody.Error>, ...args: A): Promise<R> {
		return await new Promise(async(resolve) => {
			while(true) {
				const r = await request(...args);
				if (r.ok) return resolve(r);
				else if (r.status === 401) await this.refreshToken();
				else if (r.status !== 408) {
					this.log.fatal(`Twitch request failed`, {args: {
						name: request.name,
						status: r.status,
						message: r.message
					}});
				}

				await new Promise(resolve2 => setTimeout(resolve2, 1000));
			}
		});
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

	getVODSavingTime(broadcasterType: ResponseBody.GetUsers["data"][0]["broadcaster_type"]): number {
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