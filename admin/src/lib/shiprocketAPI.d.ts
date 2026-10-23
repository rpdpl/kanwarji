export declare const getTrackingUrl: (awbNumber: string) => string;
export declare const createShiprocketOrder: (orderId: string, orderData: any) => Promise<any>;
export declare const trackShipment: (trackingId: string) => Promise<any>;
export declare const generateLabel: (shiprocketOrderIds: string[]) => Promise<any>;
export declare const cancelShiprocketOrder: (shiprocketOrderId: string) => Promise<any>;
export declare const getShipmentDetails: (shiprocketOrderId: string) => Promise<any>;
