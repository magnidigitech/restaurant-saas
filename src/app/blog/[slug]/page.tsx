import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS, BlogPost } from "@/lib/blogData";
import BlogPostClient from "@/components/blog/BlogPostClient";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) {
    return {
      title: "Article Not Found | Resto Bird",
      description: "The requested blog article could not be found.",
    };
  }

  return {
    title: `${post.title} | Resto Bird (@getrestobird)`,
    description: post.excerpt,
    keywords: [...post.keywords, "Resto Bird", "getrestobird", "restobird.com"],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://restobird.com/blog/${post.slug}`,
      siteName: "Resto Bird",
      type: "article",
      publishedTime: post.publishDate,
      authors: [post.author.name],
      images: [
        {
          url: post.featuredImage || "/resto-bird-logo.png",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@getrestobird",
      creator: "@getrestobird",
      title: post.title,
      description: post.excerpt,
      images: [post.featuredImage || "/resto-bird-logo.png"],
    },
  };
}

// Pre-generate static params for all blog posts
export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  // Structured JSON-LD Schema for BlogPosting
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishDate,
    author: {
      "@type": "Organization",
      name: post.author.name,
      url: "https://restobird.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Resto Bird",
      url: "https://restobird.com",
      logo: {
        "@type": "ImageObject",
        url: "https://restobird.com/resto-bird-logo.png",
      },
      sameAs: [
        "https://www.facebook.com/getrestobird",
        "https://www.instagram.com/getrestobird/",
        "https://x.com/getrestobird",
        "https://in.pinterest.com/getrestobird/",
        "https://www.producthunt.com/@getrestobird",
      ],
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://restobird.com/blog/${post.slug}`,
    },
    keywords: post.keywords.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://restobird.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://restobird.com/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://restobird.com/blog/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BlogPostClient post={post} relatedPosts={relatedPosts} />
    </>
  );
}
