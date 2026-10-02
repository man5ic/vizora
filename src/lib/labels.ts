import {
  Clapperboard,
  BookOpen,
  ShoppingBag,
  Receipt,
  FileText,
  MonitorSmartphone,
  Ticket,
  IdCard,
  Image as ImageIcon,
  Shapes,
} from "lucide-react";

export const CATEGORY_LABELS: Record<string, string> = {
  MOVIE_POSTER: "Movie posters",
  BOOK: "Books",
  PRODUCT: "Products",
  RECEIPT: "Receipts",
  DOCUMENT: "Documents",
  SCREENSHOT: "Screenshots",
  EVENT_FLYER: "Event flyers",
  BUSINESS_CARD: "Business cards",
  PHOTO: "Photos",
  OTHER: "Other",
};

export const CATEGORY_ICONS: Record<string, typeof Clapperboard> = {
  MOVIE_POSTER: Clapperboard,
  BOOK: BookOpen,
  PRODUCT: ShoppingBag,
  RECEIPT: Receipt,
  DOCUMENT: FileText,
  SCREENSHOT: MonitorSmartphone,
  EVENT_FLYER: Ticket,
  BUSINESS_CARD: IdCard,
  PHOTO: ImageIcon,
  OTHER: Shapes,
};

export const STATUS_LABELS: Record<string, string> = {
  UPLOADING: "Uploading",
  PROCESSING: "Analyzing",
  ANALYZED: "Analyzed",
  FAILED: "Failed",
};

export function formatEntityType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
