export interface ProductData {
    _id: string | number;
    productId?: string; // User-defined product code, optional.
    barcode: string; // Required barcode
    name: string;
    costPrice?: number;
    sellPrice?: number;
    stock?: number;
    description?: string;
    brandId?: string | number;
    categoryId: string | number;
    mainImage?: string;
    listImage?: string[];
    isVariable?: boolean;
    variables?: ProductVariantData[]; // Changed from string[] to ProductVariantData[]
    isSerial?: boolean;
    serials?: string[]; // Serials for the main product
    createdAt?: string;
    updatedAt?: string;
    isDelete?: boolean;
    source?: "kiotviet";
    inventories?: ProductInventory[]; // Tồn theo chi nhánh KiotViet
}
export interface ProductInventory {
    branchId: number;
    branchName?: string;
    onHand: number;
    reserved: number;
    cost: number;
}
export interface ProductDataToCreate extends Omit<ProductData, '_id' | 'createdAt' | 'updatedAt'> {
    // [x: string]: { attribute: Attribute[]; costPrice: number; sellPrice: number; stock: number; description: string; mainImage: string; listImage: string[]; isDelete: boolean; isSerial: boolean; serials: string[]; }[];

    productId?: string; // User-defined product code, optional.
    barcode: string; // Required barcode - will be suggested by frontend
    name: string;
    costPrice?: number;
    sellPrice?: number;
    stock?: number;
    description?: string;
    brandId?: string | number;
    categoryId: string | number;
    mainImage?: string;
    listImage?: string[];
    isVariable?: boolean;
    variablesProduct?: ProductVariantData[]; // Changed from string[] to ProductVariantData[]
    isSerial?: boolean;
    serials?: string[]; // Serials for the main product
    createdAt?: string;
    updatedAt?: string;
    isDelete?: boolean;
}
export interface ModalSerial {
    id: string;
    serialNumber: string;
}


export interface ProductVariantData {
    _id?: string; // Optional ID, can be populated when variant is a persisted entity
    attribute: AttributeData[];
    costPrice: number;
    sellPrice: number;
    stock: number;
    description?: string;
    mainImage?: string; // This is derived in the frontend, but API might expect it
    listImage?: string[];
    isDelete?: boolean; // Usually handled by DELETE endpoint or a status field
    isSerial?: boolean; // Added for variant-level serial management
    serials?: string[];
}

export interface AttributeData {
    key: string;
    value: string;
}
