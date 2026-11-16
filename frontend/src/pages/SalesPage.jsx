import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { dateTime, errorMessage, money, quantity } from "../lib/format";
import Icon from "../components/Icon";
import {
  EmptyState,
  Field,
  InlineError,
  Modal,
  Notice,
  PageHeader,
  Skeleton,
  StatusPill,
} from "../components/ui";

const PAYMENTS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otro" },
];

export default function SalesPage() {
  const { tenant, currency, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [returnSale, setReturnSale] = useState(null);
  const [returnForm, setReturnForm] = useState({
    productId: "",
    quantity: "1",
    reason: "Devolución de cambio",
  });
  const [returnError, setReturnError] = useState(null);
  const [returnStep, setReturnStep] = useState("form");
  const [returnNotice, setReturnNotice] = useState(null);
  const returnLockRef = useRef(false);

  const isTienda = tenant.vertical === "tienda";
  const canReturn = isTienda && isAdmin;

  const products = useQuery({
    queryKey: ["products"],
    queryFn: () =>
      api("/products?active=true").then((response) => response.data),
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      api("/customers?active=true").then((response) => response.data),
  });
  const sales = useQuery({
    queryKey: ["sales", "recent"],
    queryFn: () => api("/sales?limit=12").then((response) => response.data),
  });

  const taxRate = Number(tenant.settings?.taxRate ?? 0);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.data ?? [];
    return (products.data ?? []).filter((product) =>
      [product.name, product.sku, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [products.data, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    );
    const tax = subtotal * taxRate;
    return { subtotal, tax, total: subtotal + tax };
  }, [cart, taxRate]);

  const addProduct = (product) => {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        const max = product.trackStock ? Number(product.stock) : Infinity;
        if (existing.quantity + 1 > max) {
          setError({ message: `No hay más stock de ${product.name}` });
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      if (product.trackStock && Number(product.stock) <= 0) {
        setError({ message: `${product.name} no tiene existencias` });
        return current;
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const setQuantity = (productId, quantity) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const max = line.product.trackStock
            ? Number(line.product.stock)
            : Infinity;
          return { ...line, quantity: Math.max(0, Math.min(quantity, max)) };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const removeLine = (productId) => {
    setCart((current) =>
      current.filter((line) => line.product.id !== productId),
    );
  };

  const openReturn = (sale) => {
    setReturnError(null);
    setReturnStep("form");
    setReturnNotice(null);
    api(`/sales/${sale.id}`)
      .then(({ data }) => {
        const first = data.items?.find(
          (item) => (item.remainingQuantity ?? item.quantity) > 0,
        );
        setReturnForm({
          productId: first ? String(first.productId) : "",
          quantity: "1",
          reason: "Devolución de cambio",
        });
        setReturnSale(data);
      })
      .catch((err) => setError(err));
  };

  const closeReturn = () => {
    if (returnMutation.isPending) return;
    setReturnSale(null);
    setReturnStep("form");
    setReturnError(null);
  };

  const returnItem = returnSale?.items?.find(
    (item) => String(item.productId) === String(returnForm.productId),
  );

  const returnAvailable = returnItem
    ? Number(returnItem.remainingQuantity ?? returnItem.quantity)
    : 0;

  const updateReturn = (key) => (event) => {
    setReturnForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const returnMutation = useMutation({
    mutationFn: (payload) =>
      api("/sales/returns", { method: "POST", body: payload }),
    onSuccess: (response, payload) => {
      const item = returnSale?.items?.find(
        (entry) => String(entry.productId) === String(payload.productId),
      );
      setReturnSale(null);
      setReturnStep("form");
      setReturnError(null);
      setReturnNotice(
        `Se devolvieron ${quantity(payload.quantity, "unidad")} de ${
          item?.description ?? "el producto"
        }. Stock actualizado: ${quantity(response.data.newStock, "unidad")}.`,
      );
      window.setTimeout(() => setReturnNotice(null), 7000);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      setReturnError(err);
      setReturnStep("form");
    },
    onSettled: () => {
      returnLockRef.current = false;
    },
  });

  const submitReturn = (event) => {
    event.preventDefault();
    if (!returnSale || !returnItem) {
      setReturnError({ message: "Selecciona un producto de la venta" });
      return;
    }
    const amount = Number(returnForm.quantity);
    if (!returnAvailable) {
      setReturnError({ message: "Ese producto ya fue devuelto por completo" });
      return;
    }
    if (!amount || amount < 1 || amount > returnAvailable) {
      setReturnError({
        message: `La cantidad debe estar entre 1 y ${returnAvailable}`,
      });
      return;
    }
    setReturnError(null);
    setReturnStep("confirm");
  };

  const confirmReturn = () => {
    if (!returnSale || !returnItem || returnLockRef.current) return;
    const amount = Number(returnForm.quantity);
    if (!amount || amount < 1 || amount > returnAvailable) {
      setReturnStep("form");
      setReturnError({ message: "Revisa la cantidad a devolver" });
      return;
    }
    returnLockRef.current = true;
    returnMutation.mutate({
      saleId: returnSale.id,
      productId: returnItem.productId,
      quantity: amount,
      reason: returnForm.reason.trim() || null,
    });
  };

  const reset = () => {
    setCart([]);
    setCustomerId("");
    setPaymentMethod("cash");
    setNotes("");
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: (payload) => api("/sales", { method: "POST", body: payload }),
    onSuccess: (response) => {
      setLastSale(response.data);
      reset();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => setError(err),
  });

  const submit = () => {
    if (!cart.length) {
      setError({ message: "Agrega al menos un producto al ticket" });
      return;
    }
    mutation.mutate({
      customerId: customerId ? Number(customerId) : null,
      paymentMethod,
      notes: notes.trim() || null,
      items: cart.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      })),
    });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operación"
        title="Ventas"
        description="Arma el ticket, confirma el pago y el inventario se actualiza solo."
      />

      <div className="pos-grid">
        <section className="panel pos-catalog">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Catálogo</p>
              <h2>¿Qué lleva el cliente?</h2>
            </div>
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto o SKU…"
                aria-label="Buscar producto"
              />
            </div>
          </div>

          {products.isLoading ? (
            <Skeleton rows={6} />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon="box"
              title="Sin productos coincidentes"
              description="Prueba con otro nombre o agrega productos al catálogo."
            />
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`product-tile${product.trackStock && product.stock <= 0 ? " sold-out" : ""}`}
                  onClick={() => addProduct(product)}
                >
                  <span className="product-tile-cat">
                    {product.category || "General"}
                  </span>
                  <strong>{product.name}</strong>
                  <span className="product-tile-foot">
                    <span className="product-price">
                      {money(product.price, currency)}
                    </span>
                    <span
                      className={`product-stock${product.lowStock ? " low" : ""}`}
                    >
                      {product.trackStock
                        ? quantity(product.stock, product.unit)
                        : "Servicio"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="panel ticket">
          <div className="ticket-head">
            <div>
              <p className="eyebrow">Ticket actual</p>
              <h2>
                {cart.length
                  ? `${cart.length} línea${cart.length === 1 ? "" : "s"}`
                  : "Nueva venta"}
              </h2>
            </div>
            {cart.length > 0 && (
              <button type="button" className="text-button" onClick={reset}>
                Limpiar
              </button>
            )}
          </div>

          <div className="ticket-customer">
            <label className="field">
              <span className="field-label">Cliente</span>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Consumidor final</option>
                {customers.data?.map((customer) => (
                  <option value={customer.id} key={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ticket-lines">
            {cart.length === 0 ? (
              <div className="ticket-empty">
                <Icon name="cart" size={26} strokeWidth={1.3} />
                <p>Selecciona productos del catálogo para armar el ticket.</p>
              </div>
            ) : (
              cart.map((line) => (
                <div className="ticket-line" key={line.product.id}>
                  <div className="ticket-line-copy">
                    <strong>{line.product.name}</strong>
                    <span>{money(line.product.price, currency)} c/u</span>
                  </div>
                  <div className="qty-control">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.product.id, line.quantity - 1)
                      }
                      aria-label="Quitar uno"
                    >
                      −
                    </button>
                    <input
                      value={line.quantity}
                      onChange={(event) =>
                        setQuantity(
                          line.product.id,
                          Number(event.target.value) || 0,
                        )
                      }
                      inputMode="numeric"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.product.id, line.quantity + 1)
                      }
                      aria-label="Agregar uno"
                    >
                      +
                    </button>
                  </div>
                  <span className="ticket-line-total">
                    {money(line.product.price * line.quantity, currency)}
                  </span>
                  <button
                    type="button"
                    className="ticket-remove"
                    onClick={() => removeLine(line.product.id)}
                    aria-label={`Quitar ${line.product.name}`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="ticket-meta">
            <p className="field-label">Forma de pago</p>
            <div className="segmented">
              {PAYMENTS.map((payment) => (
                <button
                  type="button"
                  key={payment.value}
                  className={paymentMethod === payment.value ? "active" : ""}
                  onClick={() => setPaymentMethod(payment.value)}
                >
                  {payment.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">
                Nota <small>(opcional)</small>
              </span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observación del ticket"
                maxLength={500}
              />
            </label>
          </div>

          <div className="ticket-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(totals.subtotal, currency)}</strong>
            </div>
            <div>
              <span>Impuesto ({Math.round(taxRate * 100)}%)</span>
              <strong>{money(totals.tax, currency)}</strong>
            </div>
            <div className="ticket-total-final">
              <span>Total</span>
              <strong>{money(totals.total, currency)}</strong>
            </div>
          </div>

          {error && <InlineError error={{ message: errorMessage(error) }} />}

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={submit}
            disabled={mutation.isPending || cart.length === 0}
          >
            {mutation.isPending ? "Registrando…" : "Registrar venta"}
            {!mutation.isPending && <Icon name="check" size={18} />}
          </button>
        </aside>
      </div>

      {returnNotice && (
        <Notice tone="green" title="Devolución registrada">
          {returnNotice}
        </Notice>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Ventas recientes</h2>
          </div>
        </div>
        {sales.isLoading ? (
          <Skeleton rows={5} />
        ) : sales.data?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="align-right">Total</th>
                  {isTienda && <th className="align-right">Devolución</th>}
                </tr>
              </thead>
              <tbody>
                {sales.data.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="mono">{sale.number}</span>
                    </td>
                    <td>{sale.customerName || "Consumidor final"}</td>
                    <td>{sale.paymentLabel}</td>
                    <td className="muted">{dateTime(sale.createdAt)}</td>
                    <td>
                      <StatusPill status={sale.status} />
                    </td>
                    <td className="align-right strong">
                      {money(sale.total, currency)}
                    </td>
                    {isTienda && (
                      <td className="align-right">
                        <div className="return-cell">
                          {sale.returnStatus === "full" ? (
                            <span className="pill pill-neutral">
                              <span className="pill-dot" />
                              Devuelta
                            </span>
                          ) : sale.returnStatus === "partial" ? (
                            <span className="pill pill-amber">
                              <span className="pill-dot" />
                              Parcial
                            </span>
                          ) : (
                            <span className="muted">Sin devolución</span>
                          )}
                          {canReturn && sale.returnStatus !== "full" && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => openReturn(sale)}
                              title="Registrar devolución"
                            >
                              <Icon name="undo" size={14} />
                              Devolver
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="cart"
            title="Sin ventas registradas"
            description="Las ventas que registres aparecerán aquí."
          />
        )}
      </section>

      <Modal
        open={Boolean(lastSale)}
        title="Venta registrada"
        eyebrow={lastSale?.number}
        onClose={() => setLastSale(null)}
        size="sm"
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setLastSale(null)}
          >
            Nueva venta
          </button>
        }
      >
        {lastSale && (
          <div className="sale-success">
            <span className="success-mark">
              <Icon name="check" size={26} />
            </span>
            <p>El ticket quedó registrado y el inventario se actualizó.</p>
            <div className="receipt">
              <div>
                <span>Cliente</span>
                <strong>{lastSale.customerName || "Consumidor final"}</strong>
              </div>
              <div>
                <span>Pago</span>
                <strong>{lastSale.paymentLabel}</strong>
              </div>
              <div>
                <span>Subtotal</span>
                <strong>{money(lastSale.subtotal, currency)}</strong>
              </div>
              <div>
                <span>Impuesto</span>
                <strong>{money(lastSale.tax, currency)}</strong>
              </div>
              <div className="receipt-total">
                <span>Total</span>
                <strong>{money(lastSale.total, currency)}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(returnSale)}
        title={
          returnStep === "confirm"
            ? "Confirmar devolución"
            : "Registrar devolución"
        }
        eyebrow={returnSale?.number}
        onClose={closeReturn}
        size="sm"
        footer={
          returnStep === "confirm" ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setReturnError(null);
                  setReturnStep("form");
                }}
                disabled={returnMutation.isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmReturn}
                disabled={returnMutation.isPending}
              >
                {returnMutation.isPending
                  ? "Registrando…"
                  : "Sí, registrar devolución"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeReturn}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="return-form"
                className="btn btn-primary"
                disabled={!returnAvailable}
              >
                Confirmar devolución
              </button>
            </>
          )
        }
      >
        {returnSale && returnStep === "confirm" ? (
          <div className="return-confirm">
            <span className="return-confirm-icon">
              <Icon name="alert" size={26} strokeWidth={1.5} />
            </span>
            <p className="eyebrow">Revisa antes de continuar</p>
            <h3>¿Estás seguro de hacer esta devolución?</h3>
            <p className="return-confirm-note">
              Se repondrá el stock y la devolución quedará registrada en la
              venta. Esta acción no se puede deshacer.
            </p>
            <div className="return-confirm-summary">
              <div>
                <span>Producto</span>
                <strong>{returnItem?.description ?? "—"}</strong>
              </div>
              <div>
                <span>Cantidad</span>
                <strong>
                  {quantity(Number(returnForm.quantity), "unidad")}
                </strong>
              </div>
              <div>
                <span>Motivo</span>
                <strong>{returnForm.reason.trim() || "Sin motivo"}</strong>
              </div>
              <div>
                <span>Venta</span>
                <strong className="mono">{returnSale.number}</strong>
              </div>
            </div>
            {returnError && (
              <InlineError error={{ message: errorMessage(returnError) }} />
            )}
          </div>
        ) : returnSale ? (
          <form id="return-form" className="form-grid" onSubmit={submitReturn}>
            <div className="field-span-2">
              <div
                className={`alert ${returnSale.returnStatus === "partial" ? "alert-amber" : "alert-green"}`}
              >
                <Icon
                  name={
                    returnSale.returnStatus === "partial" ? "undo" : "check"
                  }
                  size={18}
                />
                <div>
                  <strong>
                    {returnSale.returnStatus === "full"
                      ? "Esta venta ya fue devuelta por completo"
                      : returnSale.returnStatus === "partial"
                        ? "Esta venta tiene una devolución parcial"
                        : "Venta sin devoluciones"}
                  </strong>
                  <span>
                    {returnSale.returnStatus === "full"
                      ? "No quedan unidades por devolver en esta venta."
                      : `Devueltas: ${quantity(returnSale.returnedQuantity ?? 0, "unidad")} de ${quantity(
                          returnSale.soldQuantity ?? 0,
                          "unidad",
                        )}.`}
                  </span>
                </div>
              </div>
            </div>
            <Field label="Producto" span={2} required>
              <select
                value={returnForm.productId}
                onChange={updateReturn("productId")}
                required
              >
                {returnSale.items?.map((item) => {
                  const remaining = Number(
                    item.remainingQuantity ?? item.quantity,
                  );
                  return (
                    <option
                      value={item.productId}
                      key={item.id}
                      disabled={remaining <= 0}
                    >
                      {item.description} · quedan{" "}
                      {quantity(remaining, "unidad")} por devolver
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Cantidad a devolver" required>
              <input
                type="number"
                min="1"
                max={returnAvailable || 1}
                value={returnForm.quantity}
                onChange={updateReturn("quantity")}
                required
                disabled={!returnAvailable}
              />
            </Field>
            <Field label="Disponible para devolver">
              <input value={quantity(returnAvailable, "unidad")} readOnly />
            </Field>
            <Field label="Motivo" span={2}>
              <input
                value={returnForm.reason}
                onChange={updateReturn("reason")}
                placeholder="Cambio, producto defectuoso, error de cobro…"
              />
            </Field>
            <p className="field-span-2 muted">
              El stock se repone automáticamente al confirmar la devolución.
            </p>

            {returnSale.returns?.length > 0 && (
              <div className="field-span-2 return-history">
                <p className="eyebrow">Devoluciones registradas</p>
                {returnSale.returns.map((entry) => (
                  <div className="return-history-row" key={entry.id}>
                    <Icon name="undo" size={14} />
                    <span>
                      {quantity(entry.quantity, "unidad")} ·{" "}
                      {entry.reason || "Sin motivo"}
                    </span>
                    <span className="muted">{dateTime(entry.returnedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {returnError && (
              <div className="field-span-2">
                <InlineError error={{ message: errorMessage(returnError) }} />
              </div>
            )}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
