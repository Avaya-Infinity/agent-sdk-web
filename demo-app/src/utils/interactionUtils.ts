//covnert the sdk interaction to demo-app interaction
// import { Interaction as SdkInteraction } from '@avaya/infinity-agent-sdk';
// import type { Interaction as DemoAppInteraction } from '@/types/interactions';

// export function convertSdkInteractionToDemoAppInteraction(sdkInteraction: SdkInteraction): DemoAppInteraction {
//     return {
//         id: sdkInteraction.interactionId,
//         communicationType: sdkInteraction.communicationType,
//         status: sdkInteraction.currentStatus,
//         customerName: sdkInteraction.customer.name,
//         customerPhone: sdkInteraction.customer.phone,
//         customerEmail: sdkInteraction.customer.email,
//         // queueName: sdkInteraction.queue.name,
//         // startTime: new Date(sdkInteraction.startTime),
//     };
// }