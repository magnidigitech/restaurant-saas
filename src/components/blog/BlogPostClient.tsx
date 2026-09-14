"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BlogPost, BLOG_POSTS } from "@/lib/blogData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import {
  ChevronLeft,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
  Share2,
  ArrowRight,
  BookOpen,
  Tag,
  Building2,
} from "lucide-react";

export interface BlogPostClientProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
}

export default function BlogPostClient({ post, relatedPosts }: BlogPostClientProps) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      {/* Header */}
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      {/* Main Reader Container */}
      <main className="flex-grow">
        {/* Top Breadcrumb & Article Header */}
        <section className="bg-white border-b border-slate-200 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            {/* Breadcrumbs */}
            <div className="flex items-center space-x-2 text-xs text-slate-500 mb-6 font-medium">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-slate-900 transition-colors">
                Blog
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-semibold truncate max-w-[200px] sm:max-w-xs">
                {post.title}
              </span>
            </div>

            {/* Category & Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold">
                {post.categoryLabel}
              </span>
              <span className="text-xs text-slate-500 flex items-center space-x-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{post.readTime}</span>
              </span>
              <span className="text-xs text-slate-500 flex items-center space-x-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{post.publishDate}</span>
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              {post.title}
            </h1>

            {/* Author Profile */}
            <div className="flex items-center justify-between py-4 border-t border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full object-contain bg-slate-100 p-1 border border-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {post.author.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {post.author.role} • Resto Bird (@getrestobird)
                  </div>
                </div>
              </div>

              {/* Share / Copy URL */}
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{copied ? "Link Copied!" : "Share"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Article Body Content */}
        <section className="py-10 sm:py-14">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <article className="space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
              {/* Intro Block */}
              <div className="bg-amber-50/60 border-l-4 border-amber-400 p-5 sm:p-6 rounded-r-2xl text-slate-800 text-base sm:text-lg font-medium leading-relaxed shadow-xs">
                {post.content.intro}
              </div>

              {/* Sections */}
              {post.content.sections.map((section, idx) => (
                <div key={idx} className="space-y-4 pt-4">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {section.heading}
                  </h2>

                  <p className="text-slate-700 leading-relaxed">
                    {section.body}
                  </p>

                  {/* Callout Box */}
                  {section.callout && (
                    <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-2 my-4 shadow-md">
                      <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>Resto Bird Pro Insight</span>
                      </div>
                      <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                        {section.callout}
                      </p>
                    </div>
                  )}

                  {/* Bullet Points */}
                  {section.bulletPoints && section.bulletPoints.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 space-y-2.5 my-4">
                      {section.bulletPoints.map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-start space-x-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="text-slate-700 text-xs sm:text-sm font-medium">
                            {pt}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Conclusion Block */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 space-y-4 border border-slate-800 shadow-lg mt-8">
                <div className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                  Summary & Key Takeaways
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  Take Control of Your Restaurant Margins
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {post.content.conclusion}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setIsDemoModalOpen(true)}
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>See Resto Bird Live in Action</span>
                  </button>
                </div>
              </div>

              {/* Keywords / Tags list for SEO */}
              <div className="pt-6 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>Related Topics & Keywords</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.keywords.map((kw, kIdx) => (
                    <span
                      key={kIdx}
                      className="px-3 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-medium"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            {/* Back to Blog button */}
            <div className="pt-10">
              <Link
                href="/blog"
                className="inline-flex items-center space-x-2 text-xs font-bold text-slate-700 hover:text-amber-700 transition-colors bg-white px-4 py-2.5 rounded-xl border border-slate-200"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Return to Blog Hub</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Related Posts Section */}
        {relatedPosts.length > 0 && (
          <section className="bg-white border-t border-slate-200 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-amber-500" />
                  <span>Related Restaurant Guides</span>
                </h2>
                <Link
                  href="/blog"
                  className="text-xs font-bold text-amber-700 hover:underline flex items-center space-x-1"
                >
                  <span>View All Articles</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedPosts.map((relPost) => (
                  <Link
                    key={relPost.slug}
                    href={`/blog/${relPost.slug}`}
                    className="group bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all duration-300 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                        {relPost.categoryLabel}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {relPost.readTime}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      {relPost.title}
                    </h3>
                    <p className="text-slate-600 text-xs line-clamp-2">
                      {relPost.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <SiteFooter onOpenDemo={() => setIsDemoModalOpen(true)} />

      {/* Book Demo Modal */}
      <BookDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  );
}
