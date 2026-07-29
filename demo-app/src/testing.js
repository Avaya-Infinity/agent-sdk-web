// TODO: Remove later.

window.logEvent = (...args) => {
    console.log("%cCLIENT >>>", "color: white; background-color:rgb(0, 99, 87); font-weight: bold; padding: 2px", ...args);
}

// Event Handlers:
window.SDK.subscribe("interactionReceived", (evt) => {
    logEvent("Universal Handler -> received interactionReceived", evt);
    window.intr = evt.payload.interaction;
});

window.SDK.subscribe("userStatusChanged", (evt) => {
    logEvent("Universal Handler -> received userStatusChanged", evt);
});

window.SDK.subscribe("queueAssigned", (evt) => {
    logEvent("Universal Handler -> received queueAssigned", evt);
});

window.SDK.subscribe("queueUnassigned", (evt) => {
    logEvent("Universal Handler -> received queueUnassigned", evt);
});

window.SDK.subscribe("queueStatusChanged", (evt) => {
    logEvent("Universal Handler -> received queueStatusChanged", evt);
});

window.SDK.subscribe("audioDevicesChanged", (evt) => {
    logEvent("Universal Handler -> received audioDevicesChanged", evt);
});

window.SDK.subscribe("audioDevicePermissionChanged", (evt) => {
    logEvent("Universal Handler -> received audioDevicePermissionChanged", evt);
});

window.SDK.subscribe("interactionAccepted", (evt) => {
    logEvent("Universal Handler -> received interactionAccepted", evt);
});

window.SDK.subscribe("interactionRejected", (evt) => {
    logEvent("Universal Handler -> received interactionRejected", evt);
});

window.SDK.subscribe("interactionCallDisconnected", (evt) => {
    logEvent("Universal Handler -> received interactionCallDisconnected", evt);
});

window.SDK.subscribe("interactionWrapUp", (evt) => {
    logEvent("Universal Handler -> received interactionWrapUp", evt);
});

window.SDK.subscribe("interactionCompleted", (evt) => {
    logEvent("Universal Handler -> received interactionCompleted", evt);
});

window.SDK.subscribe("interactionNotesUpdated", (evt) => {
    logEvent("Universal Handler -> received interactionNotesUpdated", evt);
});

window.SDK.subscribe("interactionCallHeld", (evt) => {
    logEvent("Universal Handler -> received interactionCallHeld", evt);
});

window.SDK.subscribe("interactionCallResumed", (evt) => {
    logEvent("Universal Handler -> received interactionCallResumed", evt);
});

window.SDK.subscribe("interactionCallEstablished", (evt) => {
    logEvent("Universal Handler -> received interactionCallEstablished", evt);
});

window.SDK.subscribe("interactionBlindTransferred", (evt) => {
    logEvent("Universal Handler -> received interactionBlindTransferred", evt);
});

window.SDK.subscribe("interactionCallMuted", (evt) => {
    logEvent("Universal Handler -> received interactionCallMuted", evt);
});

window.SDK.subscribe("interactionCallUnmuted", (evt) => {
    logEvent("Universal Handler -> received interactionCallUnmuted", evt);
});

window.SDK.subscribe("interactionTransfer", (evt) => {
    logEvent("Universal Handler -> received interactionTransfer", evt);
});

window.SDK.subscribe("interactionTransferAnswer", (evt) => {
    logEvent("Universal Handler -> received interactionTransferAnswer", evt);
});

window.SDK.subscribe("interactionTransferCancel", (evt) => {
    logEvent("Universal Handler -> received interactionTransferCancel", evt);
});

window.SDK.subscribe("interactionTransferComplete", (evt) => {
    logEvent("Universal Handler -> received interactionTransferComplete", evt);
});


window.SDK.subscribe("webSocketConnectionEstablished", (evt) => {
    logEvent("Universal Handler -> received webSocketConnectionEstablished", evt);
});

window.SDK.subscribe("webSocketConnectionError", (evt) => {
    logEvent("Universal Handler -> received webSocketConnectionError", evt);
});

window.SDK.subscribe("webSocketConnectionLost", (evt) => {
    logEvent("Universal Handler -> received webSocketConnectionLost", evt);
});

window.SDK.subscribe("webSocketConnectionClosed", (evt) => {
    logEvent("Universal Handler -> received webSocketConnectionClosed", evt);
});

window.SDK.subscribe("webRtcRegistered", (evt) => {
    logEvent("Universal Handler -> received webRtcRegistered", evt);
});

window.SDK.subscribe("webRtcRegistrationFailed", (evt) => {
    logEvent("Universal Handler -> received webRtcRegistrationFailed", evt);
});

window.SDK.subscribe("webRtcUnregistered", (evt) => {
    logEvent("Universal Handler -> received webRtcUnregistered", evt);
});

window.SDK.subscribe("webRtcUnregistrationFailed", (evt) => {
    logEvent("Universal Handler -> received webRtcUnregistrationFailed", evt);
});

window.SDK.subscribe("interactionConference", (evt) => {
    logEvent("Universal Handler -> received interactionConference", evt);
});

window.SDK.subscribe("interactionConferenceComplete", (evt) => {
    logEvent("Universal Handler -> received interactionConferenceComplete", evt);
});

window.SDK.subscribe("interactionViewerAdded", (evt) => {
    logEvent("Universal Handler -> received interactionViewerAdded", evt);
});

window.SDK.subscribe("interactionViewerRemoved", (evt) => {
    logEvent("Universal Handler -> received interactionViewerRemoved", evt);
});

window.SDK.subscribe("interactionViewerJoinedCall", (evt) => {
    logEvent("Universal Handler -> received interactionViewerJoinedCall", evt);
});

window.SDK.subscribe("interactionViewerLeftCall", (evt) => {
    logEvent("Universal Handler -> received interactionViewerLeftCall", evt);
});

window.SDK.subscribe("interactionViewerMuted", (evt) => {
    logEvent("Universal Handler -> received interactionViewerMuted", evt);
});

window.SDK.subscribe("interactionViewerUnmuted", (evt) => {
    logEvent("Universal Handler -> received interactionViewerUnmuted", evt);
});

window.setupTestingThings = ( ) => {

    // ctx.userService.subscribe("User Level Handler -> interactionReceived", (evt) => {
    //     logEvent("received interactionReceived", evt);
    //     window.intr = evt.payload.interaction;
    //     window.intr.subscribe("Interaction Level Handler -> interactionAccepted", (evt) => {
    //         logEvent("received interactionAccepted", evt);
    //     });
    
    //     window.intr.subscribe("Interaction Level Handler -> interactionRejected", (evt) => {
    //         logEvent("received interactionRejected", evt);
    //     });
    
    //     window.intr.subscribe("Interaction Level Handler -> interactionCallDisconnected", (evt) => {
    //         logEvent("received interactionCallDisconnected", evt);
    //     });
    
    //     window.intr.subscribe("Interaction Level Handler -> interactionWrapUp", (evt) => {
    //         logEvent("received interactionWrapUp", evt);
    //     });
    
    //     window.intr.subscribe("Interaction Level Handler -> interactionCompleted", (evt) => {
    //         logEvent("received interactionCompleted", evt);
    //         window.intr.unsubscribeAll();
    //     });
    //     window.intr.subscribe("Interaction Level Handler -> interactionRejected", (evt) => {
    //         logEvent("received interactionRejected", evt);
    //         window.intr.unsubscribeAll();
    //     });
    // });

    window.qs = ctx.userService.getAssignedQueues();
    logEvent("Testing things are setup, ready to test.");
}

window.acceptIntr = async () => {
    logEvent("accepting interaction");
    await window.intr.accept();
    logEvent("accept interaction completed");
}

window.rejectIntr = async () => {
    logEvent("reject interaction");
    await window.intr.reject();
    logEvent("reject interaction completed");
}

window.closeResolveIntr = async () => {
    logEvent("closing interaction - resolved");
    await window.intr.close("RESOLVED");
    logEvent("interaction wrapped up, please run completeIntr() to complete the interaction");
}

window.disconnectIntrCall = async () => {
    logEvent("disconnecting interaction call");
    await window.intr.disconnectCall();
    logEvent("interaction call disconnected");
}

window.closeUnresolveIntr = async () => {
    logEvent("closing interaction - unresolved");
    await window.intr.close("UNRESOLVED");
    logEvent("interaction completed, status: " + intr.currentStatus);
}

window.completeIntr = async () => {
    logEvent("completing interaction");
    await window.intr.complete();
    logEvent("interaction completed, status: " + intr.currentStatus);
}

window.login2Times = () => {
    window.ctx.userService.loginToCx();
    window.ctx.userService.loginToCx();
}

window.logout2Times = () => {
    window.ctx.userService.logoutFromCx({ type: "queueLogout", reason: "Default Logout" });
    window.ctx.userService.logoutFromCx({ type: "queueLogout", reason: "Default Logout" });
}

window.logoutQ = (q) => {
    q.logout({type: "queueLogout", reason: "Default Logout"});
}

window.loginQ = (q) => {
    q.login();
}

window.logoutQ2Times = (q) => {
   window.logoutQ(q);
   window.logoutQ(q); 
}

window.loginQ2Times = (q) => {
    window.loginQ(q);
    window.loginQ(q);
}

window.goForLunch = () => {
    window.ctx.userService.changeStatus({type: "away", reason: "Lunch"});
}

window.goAvailable = () => {
    window.ctx.userService.changeStatus({type: "available", reason: "Available"});
}

window.loginLogoutSameQAtOnce = (q) => {
    window.loginQ(q);
    window.logoutQ(q);
}

window.loginLogoutDiffQAtOnce = (q1, q2) => {
    window.loginQ(q1);
    window.logoutQ(q2);
}

window.intrCloseResUnresAtOnce = () => {
    window.closeResolveIntr();
    window.closeUnresolveIntr();
}