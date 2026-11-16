import { db, tenantTable } from "../../db/mysql.js";
import { badRequest, notFound, unprocessable } from "../../lib/errors.js";
import { parse, reservationSchema, roomSchema } from "../../lib/validation.js";
import { serializeCustomer } from "../../lib/serializers.js";

const ROOM_STATUSES = ["available", "occupied", "cleaning", "maintenance"];
const RESERVATION_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
];

function serializeRoom(row) {
  return {
    id: Number(row.id),
    number: row.number,
    type: row.type,
    capacity: Number(row.capacity),
    rate: Number(row.rate),
    floor: row.floor,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function serializeReservation(row) {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    roomNumber: row.room_number ?? null,
    roomType: row.room_type ?? null,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: Number(row.guests),
    nights: row.nights ?? null,
    total: Number(row.total),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function nightsBetween(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function dateOnly(value) {
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default async function hotelRoutes(fastify) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireVertical("hotel"));

  // ------------------------------------------------------------- habitaciones
  fastify.get("/rooms", async (request) => {
    const rows = await tenantTable("rooms", request.tenantId).orderBy(
      "number",
      "asc",
    );
    return { data: rows.map(serializeRoom) };
  });

  fastify.post("/rooms", async (request, reply) => {
    const input = parse(roomSchema, request.body);
    const [id] = await db("rooms").insert({
      tenant_id: request.tenantId,
      number: input.number,
      type: input.type,
      capacity: input.capacity,
      rate: input.rate,
      floor: input.floor,
      status: input.status ?? "available",
      notes: input.notes,
    });
    const row = await tenantTable("rooms", request.tenantId)
      .where("id", id)
      .first();
    return reply.code(201).send({ data: serializeRoom(row) });
  });

  fastify.patch("/rooms/:id", async (request) => {
    const input = parse(roomSchema.partial(), request.body);
    const exists = await tenantTable("rooms", request.tenantId)
      .where("id", request.params.id)
      .first();
    if (!exists) throw notFound("Habitación no encontrada");

    const row = {};
    for (const key of [
      "number",
      "type",
      "capacity",
      "rate",
      "floor",
      "notes",
    ]) {
      if (input[key] !== undefined) row[key] = input[key];
    }
    if (input.status !== undefined) {
      if (!ROOM_STATUSES.includes(input.status))
        throw badRequest("Estado de habitación inválido");
      row.status = input.status;
    }

    await tenantTable("rooms", request.tenantId)
      .where("id", request.params.id)
      .update({ ...row, updated_at: db.fn.now() });

    const updated = await tenantTable("rooms", request.tenantId)
      .where("id", request.params.id)
      .first();
    return { data: serializeRoom(updated) };
  });

  fastify.delete("/rooms/:id", async (request) => {
    const active = await tenantTable("reservations", request.tenantId)
      .where("room_id", request.params.id)
      .whereNotIn("status", ["checked_out", "cancelled", "no_show"])
      .first();
    if (active) throw unprocessable("La habitación tiene reservas activas");
    await tenantTable("rooms", request.tenantId)
      .where("id", request.params.id)
      .delete();
    return { data: { ok: true } };
  });

  // --------------------------------------------------------------- reservas
  fastify.get("/reservations", async (request) => {
    const query = db("reservations as r")
      .leftJoin("rooms as rm", "rm.id", "r.room_id")
      .where("r.tenant_id", request.tenantId)
      .select("r.*", "rm.number as room_number", "rm.type as room_type")
      .orderBy("r.check_in", "desc")
      .limit(300);

    if (request.query.status) query.where("r.status", request.query.status);
    if (request.query.upcoming === "true") {
      query
        .where("r.check_out", ">=", db.raw("CURDATE()"))
        .whereNotIn("r.status", ["cancelled", "checked_out", "no_show"]);
    }

    const rows = await query;
    return {
      data: rows.map((row) => ({
        ...serializeReservation(row),
        nights: nightsBetween(dateOnly(row.check_in), dateOnly(row.check_out)),
      })),
    };
  });

  fastify.post("/reservations", async (request, reply) => {
    const input = parse(reservationSchema, request.body);
    const nights = nightsBetween(input.checkIn, input.checkOut);
    if (nights <= 0)
      throw unprocessable("La salida debe ser posterior a la entrada");

    const room = await tenantTable("rooms", request.tenantId)
      .where("id", input.roomId)
      .first();
    if (!room) throw unprocessable("La habitación seleccionada no existe");
    if (input.guests > Number(room.capacity)) {
      throw unprocessable(
        `La habitación permite máximo ${room.capacity} huéspedes`,
      );
    }

    const overlap = await tenantTable("reservations", request.tenantId)
      .where("room_id", input.roomId)
      .whereNotIn("status", ["cancelled", "checked_out", "no_show"])
      .where("check_in", "<", input.checkOut)
      .where("check_out", ">", input.checkIn)
      .first();
    if (overlap)
      throw unprocessable("La habitación ya está reservada en esas fechas");

    if (input.customerId) {
      const customer = await tenantTable("customers", request.tenantId)
        .where("id", input.customerId)
        .first();
      if (!customer) throw unprocessable("El cliente seleccionado no existe");
    }

    const total = input.total ?? Number(room.rate) * nights;
    const [id] = await db("reservations").insert({
      tenant_id: request.tenantId,
      room_id: input.roomId,
      customer_id: input.customerId ?? null,
      guest_name: input.guestName,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests: input.guests ?? 1,
      total,
      status: input.status ?? "confirmed",
      notes: input.notes,
    });

    const row = await db("reservations as r")
      .leftJoin("rooms as rm", "rm.id", "r.room_id")
      .where("r.tenant_id", request.tenantId)
      .where("r.id", id)
      .select("r.*", "rm.number as room_number", "rm.type as room_type")
      .first();

    return reply.code(201).send({
      data: { ...serializeReservation(row), nights },
    });
  });

  fastify.patch("/reservations/:id", async (request) => {
    const input = parse(reservationSchema.partial(), request.body);
    const current = await tenantTable("reservations", request.tenantId)
      .where("id", request.params.id)
      .first();
    if (!current) throw notFound("Reserva no encontrada");

    const row = {};
    for (const key of ["guest_name", "notes", "total", "guests"]) {
      row[key] = current[key];
    }
    if (input.roomId !== undefined) row.room_id = input.roomId;
    if (input.customerId !== undefined) row.customer_id = input.customerId;
    if (input.guestName !== undefined) row.guest_name = input.guestName;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.total !== undefined) row.total = input.total;
    if (input.guests !== undefined) row.guests = input.guests;
    if (input.checkIn !== undefined) row.check_in = input.checkIn;
    if (input.checkOut !== undefined) row.check_out = input.checkOut;
    if (input.status !== undefined) {
      if (!RESERVATION_STATUSES.includes(input.status))
        throw badRequest("Estado de reserva inválido");
      row.status = input.status;
    }

    if (row.check_in && row.check_out) {
      const nights = nightsBetween(
        dateOnly(row.check_in),
        dateOnly(row.check_out),
      );
      if (nights <= 0)
        throw unprocessable("La salida debe ser posterior a la entrada");
    }

    await tenantTable("reservations", request.tenantId)
      .where("id", request.params.id)
      .update({ ...row, updated_at: db.fn.now() });

    if (input.status === "checked_in") {
      await tenantTable("rooms", request.tenantId)
        .where("id", current.room_id)
        .update({ status: "occupied" });
    }
    if (input.status === "checked_out" || input.status === "cancelled") {
      await tenantTable("rooms", request.tenantId)
        .where("id", current.room_id)
        .update({
          status: input.status === "checked_out" ? "cleaning" : "available",
        });
    }

    const updated = await db("reservations as r")
      .leftJoin("rooms as rm", "rm.id", "r.room_id")
      .where("r.tenant_id", request.tenantId)
      .where("r.id", request.params.id)
      .select("r.*", "rm.number as room_number", "rm.type as room_type")
      .first();
    return { data: serializeReservation(updated) };
  });

  fastify.delete("/reservations/:id", async (request) => {
    await tenantTable("reservations", request.tenantId)
      .where("id", request.params.id)
      .delete();
    return { data: { ok: true } };
  });

  // Clientes disponibles para el formulario de reserva.
  fastify.get("/customers", async (request) => {
    const rows = await tenantTable("customers", request.tenantId)
      .where("active", true)
      .orderBy("name", "asc")
      .limit(300);
    return { data: rows.map(serializeCustomer) };
  });
}
