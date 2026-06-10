export const formatINR = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
