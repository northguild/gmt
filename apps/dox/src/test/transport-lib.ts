/**
 * The real gmt functions the transport tests inject as a `TransportLib`, loaded by module path so
 * a test never needs the loader's dynamic imports.
 */
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { resolveLocal } from "@northguild/gmt/instant/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import type { TransportLib } from "~/lib/transport-widgets";

export const transportLib: TransportLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
};
