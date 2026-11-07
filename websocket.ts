import Module from "./index.js";

import * as Twitch from "twitch.ts";

export default class WebSocket extends Twitch.EventSub.WebSocket {
	readonly subscriptions: Twitch.EventSub.RequestBody[] = [];
	total_cost = 0;

	constructor(protocols?: string | string[] | undefined, options?: Twitch.EventSub.WebSocketOptions | undefined) {
		options ??= {};
		options.dont_open_on_start = true;
		super(protocols, options);

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
		const result = await Module.authorization.request.withRefreshing(Twitch.Helix.CreateEventSubSubscription.axiosRequest, {data});
		if (!result.ok)
			return Module.fatalWithDisabling(`Subscribing to event ${data.type} failed`, {args: {condition: data.condition}});

		this.total_cost = result.total_cost;
		this.subscriptions.push(data);
		this.open();
		return result;
	}
}