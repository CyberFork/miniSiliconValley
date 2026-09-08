import { notFound, redirect } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import { loadCoursewareBySlug } from "../../lib/courseware-store";
import { ClassroomError } from "../../lib/classroom-errors";
import CoursewareFrame from "./CoursewareFrame";

export const dynamic="force-dynamic";
export default async function CoursewarePage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {slug}=await params;const query=await searchParams;const revisionRaw=typeof query.revision==="string"?Number(query.revision):undefined;const revision=Number.isInteger(revisionRaw)&&Number(revisionRaw)>=0?revisionRaw:undefined;const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath(`/course/${encodeURIComponent(slug)}/`));requireCompletedPasswordSetup(user,`/course/${encodeURIComponent(slug)}/`);if(user.role!=="admin"&&user.role!=="mentor")notFound();const db=getClassroomDb();await ensureClassroomSchema(db);let item;try{item=await loadCoursewareBySlug(db,slug,revision);}catch(error){if(error instanceof ClassroomError&&error.status===404)notFound();throw error;}return <CoursewareFrame item={item}/>;}
