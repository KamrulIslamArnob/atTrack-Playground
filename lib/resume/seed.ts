import { DEFAULT_RESUME_APPEARANCE, type ResumeDoc } from "@/lib/types/resume-builder";

/**
 * Seed resume content translated from the historical LaTeX template context
 * summarized in docs/PlanningSummary.md into the inline markup grammar
 * Task 2 implements (**bold**, *italic*, ` | `,
 * [live](url "Label")-shaped badges, [cat](Label)/[type](Label) chips).
 *
 * Identity fields (name, title, portfolio/GitHub/LinkedIn links, email) are
 * the real owner's — everything else is placeholder/dummy content for the
 * user to overwrite per application. Never seed real phone numbers, work
 * history, skills, education, or achievements here.
 *
 * Returns a fresh object every call — never share/mutate a module-level
 * singleton, callers own their copy (e.g. to seed a new document row).
 */
export function seedResumeDoc(): ResumeDoc {
  return {
    appearance: { ...DEFAULT_RESUME_APPEARANCE },
    header: {
      name: "Kamrul Islam Arnob",
      title: "Software Engineer",
      summary:
        "Motivated software engineer with experience building and shipping full-stack applications. Skilled at collaborating with cross-functional teams to design, develop, and deliver reliable products.",
      topLinks: [
        { id: crypto.randomUUID(), variant: "port", icon: "globe", label: "Portfolio", url: "https://arnob.codes" },
        { id: crypto.randomUUID(), variant: "contact", icon: "github", label: "GitHub", url: "https://github.com/KamrulIslamArnob" },
        { id: crypto.randomUUID(), variant: "contact", icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/kamrulislamarnob/" },
        { id: crypto.randomUUID(), variant: "contact", icon: "mappin", label: "Dhaka" },
      ],
      bottomLinks: [
        { id: crypto.randomUUID(), variant: "contact", icon: "envelope", label: "connect.arnob@gmail.com", url: "mailto:connect.arnob@gmail.com" },
        { id: crypto.randomUUID(), variant: "contact", icon: "phone", label: "+1 555-010-1234", url: "tel:15550101234" },
      ],
    },

    experience: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left1: "Example Company Inc.",
          right1: "Remote | City, Country [type](Full-Time)",
          left2: "Software Engineer",
          right2: "Jan 2023 – Present",
          bullets: [
            'Developed and maintained key features for a **customer-facing web application**, collaborating with design and product teams. [live](https://example.com "example.com")',
            "Improved application performance by **20%** through code optimization and caching strategies.",
            '[cred](https://example.com/credential "Credentials") Recognized with an **internal excellence award** for contributions to a major product launch.',
          ],
        },
      ],
    },

    skills: {
      visible: true,
      rows: [
        {
          id: crypto.randomUUID(),
          label: "Languages & Frameworks",
          value: "JavaScript, Python, Java, React, Node.js",
        },
        {
          id: crypto.randomUUID(),
          label: "AI & Machine Learning",
          value: "Machine Learning Basics, Data Analysis",
        },
        {
          id: crypto.randomUUID(),
          label: "Databases & Storage",
          value: "[cat](RDBMS) PostgreSQL, MySQL [cat](No-SQL) MongoDB, Redis",
        },
        {
          id: crypto.randomUUID(),
          label: "UI/UX & Design",
          value: "Wireframing, Figma (Beginner)",
        },
        {
          id: crypto.randomUUID(),
          label: "Backend & Architecture",
          value: "REST APIs, MVC, Unit Testing",
        },
        {
          id: crypto.randomUUID(),
          label: "Tools & Infrastructure",
          value: "Git, GitHub, Docker",
        },
      ],
      callout:
        "**Continuous Learner:** Actively expands technical skills through online courses, personal projects, and open-source contributions.",
    },

    projects: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: "**Personal Portfolio Website** | *React | Tailwind CSS*",
          right: '[repo](https://github.com/example/portfolio "Repository Link") [live](https://example.com "Live")',
          bullets: [
            "Built and deployed a responsive personal portfolio site showcasing projects and skills.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Task Management App** | *Node.js | Express | MongoDB*",
          right: '[repo](https://github.com/example/task-manager "Repository Link")',
          bullets: [
            "Built a full-stack task management application with user authentication and real-time updates.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**E-Commerce Demo Store** | *Next.js | TypeScript | Stripe*",
          right: '[live](https://example.com/demo-store "Live")',
          bullets: [
            "Implemented a demo e-commerce storefront with product catalog, cart, and checkout flow.",
          ],
        },
      ],
    },

    education: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left1: "Example University",
          right1: "GPA: 3.50/4.00",
          left2: "B.Sc. in Computer Science",
          right2: "Sep 2019 – May 2023",
          bullets: [
            "Graduated with honors.",
            "Active member of the Computer Science Society.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left1: "Example High School",
          right1: "GPA: 5.00/5.00",
          left2: "Higher Secondary Certificate (Science)",
          right2: "2017 – 2019",
          bullets: [],
        },
      ],
    },

    training: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: '[cred](https://example.com/credential "Credentials") **Full-Stack Web Development Program**',
          right: "",
          bullets: [],
          note:
            "Covered front-end and back-end development, databases, APIs, and deployment practices.",
        },
      ],
    },

    awards: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: '[cred](https://example.com/award-1 "Credentials") **"Employee of the Month" Award** | *Example Company Inc.*',
          right: "2024",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://example.com/award-2 "Credentials") **1st Runner-Up, University Hackathon** | *Example University*',
          right: "2022",
          bullets: [],
        },
      ],
    },

    certifications: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: '[cred](https://example.com/cert-1 "Credentials") **Introduction to Machine Learning** | *Example Learning Platform*',
          right: "May 2023",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://example.com/cert-2 "Credentials") **Web Development Fundamentals** | *Example Academy*',
          right: "Mar 2022",
          bullets: [],
        },
      ],
    },

    leadership: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: "**University Tech Club** | *Team Lead*",
          right: "Sep 2021 – May 2023",
          bullets: [
            "Led a team of **5 members** to organize workshops and coding events for students.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Volunteer Coding Mentor** | *Mentor*",
          right: "Jan 2021 – Present",
          bullets: [
            "Mentored beginner programmers in weekly study sessions.",
          ],
        },
      ],
    },
  };
}
