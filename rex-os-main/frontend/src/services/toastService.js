import { toast } from "react-toastify";

export function success(message) {
  toast.success(message);
}

export function error(message) {
  toast.error(message);
}

export function info(message) {
  toast.info(message);
}

export function warning(message) {
  toast.warning(message);
}