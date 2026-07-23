import { useEffect, useRef, useState } from "react";
import {
    AvayaInfinityAgentSdk,
    WebSocketConnectionEventType,
    WebSocketConnectionState,
} from "@avaya/infinity-agent-sdk";
import { Radio, RefreshCw } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type WebSocketStatus =
    | "connected"
    | "reconnecting"
    | "disconnected"
    | "unknown";

function mapWebSocketState(
    state: WebSocketConnectionState
): WebSocketStatus {
    switch (state) {
        case WebSocketConnectionState.CONNECTED:
            return "connected";
        case WebSocketConnectionState.RECONNECTING:
        case WebSocketConnectionState.AWAITING_RECONNECTION:
            return "reconnecting";
        case WebSocketConnectionState.FAILED:
        case WebSocketConnectionState.CLOSED:
            return "disconnected";
        case WebSocketConnectionState.CONNECTING:
            return "unknown";
    }
    return "unknown";
}
function WebSocketConnectionIndicator() {
    const [webSocketStatus, setWebSocketStatus] = useState<WebSocketStatus>(
        () => {
            try {
                return mapWebSocketState(
                    AvayaInfinityAgentSdk.webSocketConnectionState
                );
            } catch {
                return "unknown";
            }
        }
    );
    const [showReconntingIndicator, setShowReconntingIndicator] =
        useState(false);

    const [backoffSecondsLeft, setBackoffSecondsLeft] = useState<number | null>(
        null
    );
    // Ref keeps the interval ID stable across re-renders so stopTimer always
    // cancels the right interval regardless of when it was captured in a closure.
    const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function stopTimer() {
        if (timerIdRef.current !== null) {
            clearInterval(timerIdRef.current);
            timerIdRef.current = null;
        }
        setBackoffSecondsLeft(null);
    }

    // endTimeMs is passed in directly so the interval callback closes over a
    // plain number, not the backoffEndTimeMs state (which would be stale).
    function startTimer(endTimeMs: number) {
        stopTimer();
        setBackoffSecondsLeft(Math.ceil((endTimeMs - Date.now()) / 1000));
        timerIdRef.current = setInterval(() => {
            const remaining = endTimeMs - Date.now();
            if (remaining <= 0) {
                stopTimer();
            } else {
                setBackoffSecondsLeft(Math.ceil(remaining / 1000));
            }
        }, 1000);
    }

    useEffect(() => {
        const reconnectingHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.RECONNECTING,
            () => {
                stopTimer();
                setWebSocketStatus("reconnecting");
                if (!showReconntingIndicator) {
                    setShowReconntingIndicator(true);
                }
            }
        );

        const attemptFailedHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.RECONNECTION_ATTEMPT_FAILED,
            (event) => {
                const { retryAfter } = event.payload;
                const endTimeMs = Date.now() + retryAfter;
                setShowReconntingIndicator(false);
                startTimer(endTimeMs);
            }
        );

        const connectedHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.CONNECTED,
            () => {
                setWebSocketStatus("connected");
                setShowReconntingIndicator(false);
                stopTimer();
            }
        );

        const failedHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.CONNECTION_FAILED,
            () => {
                setWebSocketStatus("disconnected");
                setShowReconntingIndicator(false);
                stopTimer();
            }
        );

        const errorHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.CONNECTION_ERROR,
            () => {
                setWebSocketStatus("reconnecting");
                setShowReconntingIndicator(true);
            }
        );

        const closedHandlerId = AvayaInfinityAgentSdk.subscribe(
            WebSocketConnectionEventType.CONNECTION_CLOSED,
            () => {
                setWebSocketStatus("disconnected");
                setShowReconntingIndicator(false);
                stopTimer();
            }
        );

        return () => {
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.RECONNECTING,
                reconnectingHandlerId
            );
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.RECONNECTION_ATTEMPT_FAILED,
                attemptFailedHandlerId
            );
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.CONNECTED,
                connectedHandlerId
            );
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.CONNECTION_FAILED,
                failedHandlerId
            );
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.CONNECTION_ERROR,
                errorHandlerId
            );
            AvayaInfinityAgentSdk.unsubscribe(
                WebSocketConnectionEventType.CONNECTION_CLOSED,
                closedHandlerId
            );
            stopTimer();
        };
    }, []);

    const handleRetry = () => {
        try {
            setShowReconntingIndicator(true);
            AvayaInfinityAgentSdk.retryWebSocketConnection();
        } catch (error) {
            console.error(
                "Error occurred during retry WebSocket connection",
                error
            );
        }
    };

    const canRetry =
        webSocketStatus === "disconnected" ||
        webSocketStatus === "reconnecting";

    const statusStyles = {
        connected: "text-green-600",
        disconnected: "text-red-600",
        reconnecting: "text-yellow-600",
        unknown: "text-gray-500",
    } as const;

    const statusLabel = {
        connected: "WebSocket Connected",
        disconnected: "WebSocket Disconnected",
        reconnecting: "WebSocket Reconnecting",
        unknown: "WebSocket Connecting",
    } as const;

    return (
        <div className="inline-flex items-center gap-2">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${statusStyles[webSocketStatus]}`}
                        aria-label={statusLabel[webSocketStatus]}
                    >
                        <Radio className="h-4 w-4" aria-hidden="true" />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                    {statusLabel[webSocketStatus]}
                </TooltipContent>
            </Tooltip>

            {backoffSecondsLeft !== null && (
                <span className="text-xs text-yellow-600 tabular-nums">
                    Retrying in {backoffSecondsLeft}s…
                </span>
            )}

            {canRetry && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none"
                            aria-label="Retry WebSocket connection"
                        >
                            <RefreshCw
                                className={`h-4 w-4${
                                    showReconntingIndicator
                                        ? " animate-spin"
                                        : ""
                                }`}
                                aria-hidden="true"
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                        {statusLabel[webSocketStatus]}
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

export { WebSocketConnectionIndicator };
