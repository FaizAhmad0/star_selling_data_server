import mongoose from "mongoose";
import User from "./user.model.js";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", CounterSchema);

export async function getNextUid() {
  const lastUser = await User.findOne().sort({ uid: -1 }).limit(1).lean();
  const maxUid = lastUser?.uid ?? 0;

  await Counter.findOneAndUpdate(
    { _id: "uid" },
    { $set: { seq: maxUid } },
    { upsert: true },
  );

  const counter = await Counter.findOneAndUpdate(
    { _id: "uid" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}
