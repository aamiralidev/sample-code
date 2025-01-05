self.addEventListener("push", (event) => {
    console.log("push event has been fired");
    const data = event.data ? event.data : {};

    const options = {
        body: data.body || "You have an incoming call!",
        actions: [
            { action: "accept", title: "Accept", icon: "/accept.png" },
            { action: "reject", title: "Reject", icon: "/reject.png" },
        ],
        tag: data.tag || "incoming-call", // Unique identifier for this notification
        requireInteraction: true,
    };

    event.waitUntil(
        self.registration.showNotification("Incoming Call", options)
    );
});


// Handle notification click
self.addEventListener("notificationclick", (event) => {
    const tag = event.notification.data.tag;
    event.notification.close(); // Close the notification

    if (event.action === "accept") {
        console.log("Call accepted via notification!");
        // Send a message to the app
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ action: "accept" , tag});
                });
            })
        );
    } else if (event.action === "reject") {
        console.log("Call rejected via notification!");
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ action: "reject", tag });
                });
            })
        );
    } else {
        console.log("Notification clicked without action");
    }
});


self.addEventListener("message", (event) => {
    if (event.data && event.data.action === "cancel-notification") {
        event.waitUntil(
            self.registration.getNotifications({ tag: event.data.tag || "incoming-call" }).then((notifications) => {
                notifications.forEach((notification) => notification.close());
                console.log("Notification closed.");
            })
        );
    }
});
