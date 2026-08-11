import Module from "./index.js";

import { EventSub, Request } from "twitch.ts";
import { EventEmitter } from "node:events";

class EventSubController extends EventEmitter {
	connection: EventSub.Connection<typeof Module.scopes> | null = null;

	readonly subscriptions: EventSub.Subscription[] = [];
	async addSubscriptions(...subscriptions: EventSub.Subscription[]) {
		this.subscriptions.push(...subscriptions);
		if (this.connection)
			for (const subscription of this.subscriptions)
				await this.addSubscriptionToConnection(subscription);
	}

	open() {
		if (this.connection) {
			//Module.log.warn("Tried to start twitch eventsub connection when its already opened");
			return;
		}

		this.connection = EventSub.startWebSocket(Module.authorization);
		this.connection.on("message", m => this.emit("message", m));
		this.connection.on("session_welcome", this.onSessionWelcome);
		this.connection.on("session_keepalive", m => this.emit("session_keepalive", m));
		this.connection.on("session_reconnect", m => this.emit("session_reconnect", m));
		this.connection.on("notification", m => this.emit("notification", m));
		this.connection.on("revocation", m => this.emit("revocation", m));
		this.connection.on("close", (code, reason) => this.emit("close", code, reason));
	}

	close() {
		if (!this.connection) {
			//Module.log.warn("Tried to close twitch eventsub connection when its already closed");
			return;
		}

		this.connection.close();
		this.connection = null;
		while(Module.data.subscriptionsID.length > 0)
			Module.data.subscriptionsID.pop();
		Module.data.save();
	}

	private async onSessionWelcome(message: EventSub.Message.SessionWelcome, isReconnected: boolean) {
		if (!isReconnected)
			for (const subscription of this.subscriptions)
				await this.addSubscriptionToConnection(subscription);
		this.emit("session_welcome", message, isReconnected);
	}

	private async addSubscriptionToConnection(subscription: EventSub.Subscription) {
		const request = await Module.runRequestWithTokenRefreshing(Request.CreateEventSubSubscription, Module.authorization, subscription);
		if (!request.ok) {
			Module.log.error("Subscribing to twitch event failed", {args: {
				name: "CreateEventSubSubscription",
				status: request.status,
				message: request.message
			}});
			return;
		}
		Module.log.verbose("Subscribed to twitch event", {args: {
			id: request.data.id,
			event: `${request.data.type}@${request.data.version}`,
			cost: request.data.cost,
			condition: request.data.condition,
			total: request.total,
			total_cost: `${request.total_cost} / ${request.max_total_cost}`
		}});
		Module.data.subscriptionsID.push(request.data.id);
		Module.data.save();
	}

	override once<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, listener: EventSub.ConnectionEvents[EventName]) {
		return super.once(eventName, listener);
	}
	override prependOnceListener<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, listener: EventSub.ConnectionEvents[EventName]) {
		return super.prependOnceListener(eventName, listener);
	}
	override on<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, listener: EventSub.ConnectionEvents[EventName]) {
		return super.on(eventName, listener);
	}
	override prependListener<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, listener: EventSub.ConnectionEvents[EventName]) {
		return super.prependListener(eventName, listener);
	}
	override off<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, listener: EventSub.ConnectionEvents[EventName]) {
		return super.off(eventName, listener);
	}
	override emit<EventName extends keyof EventSub.ConnectionEvents>(eventName: EventName, ...args: Parameters<EventSub.ConnectionEvents[EventName]>) {
		return super.emit(eventName, ...args);
	}
}

export default new EventSubController();