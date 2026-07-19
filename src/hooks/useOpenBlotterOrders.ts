import { useEffect, useState } from "react";
import { orderBlotter, type BlotterOrder } from "../store/orderBlotter";

/** Live list of non-terminal desk orders from the blotter. */
export function useOpenBlotterOrders(): BlotterOrder[] {
  const [orders, setOrders] = useState<BlotterOrder[]>(() => orderBlotter.listOpen());

  useEffect(() => {
    const refresh = () => setOrders(orderBlotter.listOpen());
    refresh();
    return orderBlotter.subscribe(refresh);
  }, []);

  return orders;
}
