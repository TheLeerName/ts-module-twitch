import Module from "./index.js";

import * as Twitch from "twitch.ts";

export default class WebSocket extends Twitch.EventSub.WebSocket {
	readonly subscriptions: [string, Twitch.EventSub.RequestBody][] = [];
	total_cost = 0;

	constructor(protocols?: string | string[] | undefined, options?: Twitch.EventSub.WebSocketOptions | undefined) {
		options ??= {};
		options.dont_open_on_start = true;
		super(protocols, options);

		this.on("session_welcome", async(message, isReconnectedByTwitch) => {
			if (!isReconnectedByTwitch) {
				for (const entry of this.subscriptions) {
					const result = await Module.authorization.request(Twitch.Helix.CreateEventSubSubscription.axiosRequest, {data: entry[1]});
					if (!result.ok)
						return Module.fatalWithDisabling(`Subscribing to event ${entry[1].type} failed`, {args: {condition: entry[1].condition}});

					this.total_cost = result.total_cost;
					entry[0] = result.data[0].id;
				}
			}
		});
		this.on("revocation", message => {
			if (message.payload.subscription.status === "authorization_revoked")
				Module.fatalWithDisabling("Owner of access token has revoked the authorization");
			else if (message.payload.subscription.status === "user_removed")
				Module.fatalWithDisabling("Broadcaster or chatting user was banned");
			else if (message.payload.subscription.status === "version_removed")
				Module.fatalWithDisabling(`${message.payload.subscription.type} with version ${message.payload.subscription.version} is no longer supported`);
		});
	}

	async subscribeToEvent<Condition extends {} = {}>(event: (condition: Condition, transport: Twitch.EventSub.Transport) => Twitch.EventSub.RequestBody, condition: Condition) {
		if (!this.opened) {
			this.open();
			await new Promise<void>(resolve => this.once("session_welcome", message => resolve()));
		}

		const data = event(condition, {method: "websocket", session_id: this.session.id});
		const result = await Module.authorization.request(Twitch.Helix.CreateEventSubSubscription.axiosRequest, {data});
		if (!result.ok)
			return Module.fatalWithDisabling(`Subscribing to event ${data.type} failed`, {args: {condition: data.condition}});

		this.total_cost = result.total_cost;
		this.open();
		return this.subscriptions.push([result.data[0].id, data]);
	}

	async unsubscribeFromEvent(index: number): Promise<Twitch.Response<{}, Twitch.ResponseBodyError>> {
		const [id, data] = this.subscriptions[index];
		if (!id)
			return {ok: false, status: 404, message: "not found", headers: {}};

		const result = await Module.authorization.request(Twitch.Helix.DeleteEventSubSubscription.axiosRequest, {id});
		if (!result.ok)
			return Module.fatalWithDisabling(`Unsubscribing from event ${data.type} failed`, {args: {condition: data.condition}});

		this.subscriptions.splice(index, 1);
		if (this.subscriptions.length < 1 && this.opened)
			this.close();
		return result;
	}
}