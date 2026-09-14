"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BLOG_POSTS, BLOG_CATEGORIES, BlogPost } from "@/lib/blogData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import {
  Search,
  BookOpen,
  ArrowRight,
  Clock,
  Calendar,
  Sparkles,
  Tag,
} from "lucide-react";

export default function BlogHubClient() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  // Filter posts based on category & search query
  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCategory =
      selectedCategory === "all" || post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.keywords.some((k) =>
        k.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const featuredPost = BLOG_POSTS[0];
  const gridPosts =
    selectedCategory === "all" && searchQuery === ""
      ? filteredPosts.slice(1)
      : filteredPosts;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      {/* Header */}
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Banner Section */}
        <section className="relative overflow-hidden bg-slate-900 text-white py-16 sm:py-20 border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-slate-900 to-slate-950 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Resto Bird Insights & Operating Guides</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
                Hospitality Knowledge & <br />
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Restaurant Growth Playbooks
                </span>
              </h1>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Practical strategies on inventory depletion, POS integrations, workforce management, and menu engineering for modern restaurant operators. Powered by @getrestobird.
              </p>

              {/* Search Bar */}
              <div className="relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search articles by title, recipe, inventory, POS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl text-white text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all shadow-inner"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories Bar */}
        <section className="bg-white border-b border-slate-200 sticky top-16 z-40 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center space-x-2 overflow-x-auto py-3 scrollbar-none">
              {BLOG_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Featured Post (Only show on default 'all' & empty search) */}
        {selectedCategory === "all" && searchQuery === "" && featuredPost && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6">
            <div className="text-xs font-mono font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Featured Masterclass</span>
            </div>
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="group block bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 hover:border-amber-300 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-bold">
                      {featuredPost.categoryLabel}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center space-x-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{featuredPost.readTime}</span>
                    </span>
                    <span className="text-xs text-slate-500 flex items-center space-x-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{featuredPost.publishDate}</span>
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors leading-tight">
                    {featuredPost.title}
                  </h2>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">
                    {featuredPost.excerpt}
                  </p>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={featuredPost.author.avatar}
                        alt={featuredPost.author.name}
                        className="w-9 h-9 rounded-full object-contain bg-slate-100 p-1 border border-slate-200"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {featuredPost.author.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {featuredPost.author.role}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      <span>Read Full Article</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-100 flex items-center justify-center min-h-[220px]">
                  <div className="text-center space-y-3">
                    <img
                      src="/resto-bird-logo.png"
                      alt="Resto Bird"
                      className="h-10 w-auto mx-auto object-contain"
                    />
                    <div className="text-xs font-medium text-slate-500 max-w-xs mx-auto">
                      Resto Bird Operating Blueprint
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Articles Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <span>
                {selectedCategory === "all"
                  ? "All Latest Articles"
                  : BLOG_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </span>
            </h2>
            <div className="text-xs font-semibold text-slate-500">
              Showing {filteredPosts.length} article
              {filteredPosts.length === 1 ? "" : "s"}
            </div>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-lg mx-auto">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 mb-1">
                No articles found
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                We couldn&apos;t find any articles matching &quot;{searchQuery}&quot;. Try searching with another keyword.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {gridPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-amber-300 shadow-xs hover:shadow-lg transition-all duration-300"
                >
                  {/* Category Pill & Meta */}
                  <div className="flex items-center justify-between text-xs mb-4">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
                      {post.categoryLabel}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors mb-3 leading-snug">
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 line-clamp-3 flex-grow">
                    {post.excerpt}
                  </p>

                  {/* Author & Footer */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-7 h-7 rounded-full object-contain bg-slate-100 p-0.5 border border-slate-200"
                      />
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">
                        {post.author.name}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1">
                      <span>Read</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Call to Action Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 my-16">
          <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden border border-slate-800 shadow-xl">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-2xl relative z-10 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Experience Resto Bird in Action</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Ready to optimize your restaurant&apos;s food costs & shift margins?
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Connect Toast, Square, or Clover in minutes. Request a live 1-on-1 demo with our restaurant operations experts today.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center space-x-2 text-xs sm:text-sm"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Book a 1-on-1 Walkthrough</span>
                </button>
              </div>
            </div>
          </div>
        </section>
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
