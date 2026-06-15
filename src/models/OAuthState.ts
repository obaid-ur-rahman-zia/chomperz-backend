import mongoose, { Schema, Document } from "mongoose";

export interface IOAuthState extends Document {
  state: string;
  codeVerifier: string;
  createdAt: Date;
}

const OAuthStateSchema = new Schema<IOAuthState>(
  {
    state: { type: String, required: true, unique: true },
    codeVerifier: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 },
  },
  { timestamps: false }
);

export const OAuthState = mongoose.model<IOAuthState>("OAuthState", OAuthStateSchema);
