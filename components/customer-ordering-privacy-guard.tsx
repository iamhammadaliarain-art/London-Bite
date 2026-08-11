"use client";

import { useEffect, useState } from "react";
import { CustomerOrderingV2 } from "@/components/customer-ordering-v2";

const PRIVACY_CLEAR_EVENT = "lb:privacy-clear";

export function CustomerOrderingPrivacyGuard() {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const storagePrototype = Storage.prototype;
    const originalRemoveItem = storagePrototype.removeItem;

    storagePrototype.removeItem = function patchedRemoveItem(key: string) {
      originalRemoveItem.call(this, key);
      if (this === window.localStorage && key === "lb.orders") {
        window.dispatchEvent(new Event(PRIVACY_CLEAR_EVENT));
      }
    };

    const handlePrivacyClear = () => setEpoch((value) => value + 1);
    window.addEventListener(PRIVACY_CLEAR_EVENT, handlePrivacyClear);

    return () => {
      window.removeEventListener(PRIVACY_CLEAR_EVENT, handlePrivacyClear);
      if (storagePrototype.removeItem === patchedRemoveItem) storagePrototype.removeItem = originalRemoveItem;
    };
  }, []);

  return <CustomerOrderingV2 key={epoch} />;
}
