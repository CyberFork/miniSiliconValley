import type { Metadata } from "next";
import { CourseOutlineApp } from "./CourseOutlineApp";
import { getReleasedCourseOutline } from "../lib/course-outline";

export const metadata: Metadata = {
  title: "课程大纲",
  description: "从真实科技史进入五步创业闭环：找真问题、定真方案、做真产品、进真市场、跑真运营，最终完成六分钟 Demo Day。",
  alternates: { canonical: "/course/" },
};

export default async function CoursePage() {
  const courses = await getReleasedCourseOutline();
  return <CourseOutlineApp courses={courses} />;
}
