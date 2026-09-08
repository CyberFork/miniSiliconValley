import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../db";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import { listCourseware } from "../lib/courseware-store";
import styles from "./course.module.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"导师课件播放"};
export default async function CourseLibrary(){const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath("/course/"));requireCompletedPasswordSetup(user,"/course/");if(user.role!=="admin"&&user.role!=="mentor")notFound();const db=getClassroomDb();await ensureClassroomSchema(db);const items=await listCourseware(db);return <main className={styles.page}><header className={styles.top}><BrandHomeLink title="导师课件播放"/><nav><Link href="/classroom/">课堂中心</Link><Link href="/studio/courseware/">管理导师课件</Link></nav></header><section className={styles.hero}><small>COURSEWARE PLAYER · P / D / M / O</small><h1>课件是导师的工具，<br/>不是整门课程。</h1><p>这里仅播放已发布的导师课件。每一套 HTML 课件都有不可变版本；课堂开始前绑定 exact 版本，中控不会替导师自动翻页。</p></section><section className={styles.grid}>{items.filter((item)=>item.releasedRevision!==null).map((item)=><article className={styles.card} data-role={item.mentorRole} key={item.packageId}><small>{item.mentorRole} · MENTOR COURSEWARE</small><h2>{item.title}</h2><p className={styles.meta}>/{item.slug}/ · r{item.releasedRevision}<br/>{item.releasedDigest?.slice(0,24)}…</p><Link href={`/course/${item.slug}/`}>打开已发布版本 →</Link></article>)}</section></main>}
