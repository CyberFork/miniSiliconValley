import type { Metadata } from "next";
import StudioRoute from "./StudioRoute";
export const metadata: Metadata = { title: "Course Studio" };
export const dynamic = "force-dynamic";
export default function Page(){return <StudioRoute section="home"/>;}
