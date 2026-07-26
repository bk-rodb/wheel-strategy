import { useEffect, useState } from "react";
import { orderBlotter, type BlotterOrder } from "../store/orderBlotter";

function sameOpenOrders(a: BlotterOrder[], b: BlotterOrder[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (o, i) =>
      o.clientOrderId === b[i].clientOrderId &&
      o.deskState === b[i].deskState &&
      o.orderId === b[i].orderId &&
      o.status === b[i].status,
  );
}

/** Live list of non-terminal desk orders from the blotter. */
export function useOpenBlotterOrders(): BlotterOrder[] {
  const [orders, setOrders] = useState<BlotterOrder[]>(() => orderBlotter.listOpen());

  useEffect(() => {
    const refresh = () => {
      const next = orderBlotter.listOpen();
      setOrders((prev) => (sameOpenOrders(prev, next) ? prev : next));
    };
    refresh();
    return orderBlotter.subscribe(refresh);
  }, []);

  return orders;
}
