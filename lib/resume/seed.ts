import type { ResumeDoc } from "@/lib/types/resume-builder";

/**
 * The user's real resume content, transcribed verbatim from
 * docs/superpowers/specs/resume-template-reference.tex into the inline
 * markup grammar Task 2 implements (**bold**, *italic*, ` | `,
 * [live](url "Label")-shaped badges, [cat](Label)/[type](Label) chips).
 *
 * Returns a fresh object every call — never share/mutate a module-level
 * singleton, callers own their copy (e.g. to seed a new document row).
 */
export function seedResumeDoc(): ResumeDoc {
  return {
    header: {
      name: "Kamrul Islam Arnob",
      title: "Software Engineer",
      summary:
        "Software developer combining full-stack web development with AI integration. Experienced in designing UI/UX, building APIs with FastAPI and Node.js, and managing databases for production applications.",
      topLinks: [
        { id: crypto.randomUUID(), variant: "port", icon: "globe", label: "Portfolio", url: "https://arnob.codes" },
        { id: crypto.randomUUID(), variant: "contact", icon: "github", label: "GitHub", url: "https://github.com/KamrulIslamArnob" },
        { id: crypto.randomUUID(), variant: "contact", icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/kamrulislamarnob/" },
        { id: crypto.randomUUID(), variant: "contact", icon: "mappin", label: "Dhaka" },
      ],
      bottomLinks: [
        { id: crypto.randomUUID(), variant: "contact", icon: "envelope", label: "connect.arnob@gmail.com", url: "mailto:connect.arnob@gmail.com" },
        { id: crypto.randomUUID(), variant: "contact", icon: "phone", label: "+880 1984 933215", url: "tel:8801984933215" },
      ],
    },

    experience: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left1: "Programming Hero (Phitron Team)",
          right1: "Semi-Hybrid | Dhaka, Bangladesh [type](Full-Time)",
          left2: "Senior Executive, Marketing",
          right2: "Mar 2023 – July 2026",
          bullets: [
            'Acted as **Product Manager** for Phitron\'s course platform and blog, managing content architecture, publishing workflows, UX feedback loops, and feature prioritization. [live](https://phitron.io/ "phitron.io")',
            "Scaled short-form video output **3x**, directed **2 original short films**, and managed the end-to-end **Meta Ads strategy** across **5 enrollment cycles**.",
            '[cred](https://www.linkedin.com/posts/kamrulislamarnob_honored-to-receive-the-master-of-content-activity-7400166555340304384-ukSU "Credentials") Awarded **"Master of Content & Creativity 2025"** - recognized for technical creativity, execution quality, and measurable business impact.',
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
          value: "Python, FastAPI, React, Next.js, Node.js (Express.js), TypeScript, C#, ASP.NET Core",
        },
        {
          id: crypto.randomUUID(),
          label: "AI & Machine Learning",
          value: "LangGraph, LangChain, RAG Systems, AI Agent Workflows",
        },
        {
          id: crypto.randomUUID(),
          label: "Databases & Storage",
          value: "[cat](RDBMS) PostgreSQL, MySQL [cat](No-SQL) MongoDB, Redis, Firebase, Supabase",
        },
        {
          id: crypto.randomUUID(),
          label: "UI/UX & Design",
          value: "UI/UX Design (Intermediate), Figma (Intermediate)",
        },
        {
          id: crypto.randomUUID(),
          label: "Backend & Architecture",
          value: "OOP, SOLID Principles, REST, Clean Architecture, CQRS, Event-driven architecture",
        },
        {
          id: crypto.randomUUID(),
          label: "Tools & Infrastructure",
          value: "Git, GitHub, Docker, Google Workspace",
        },
      ],
      callout:
        "**AI-Driven Development:** Practices context engineering and spec-first development with AI coding agents (Claude Code/Codex), scoping context deliberately, defining requirements before implementation, and verifying every agent-generated change before merge.",
    },

    projects: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: "**AI-Powered University Tutoring System** | *LangChain | LangGraph | Python*",
          right:
            '[repo](https://github.com/KamrulIslamArnob/COSMOS-Backend "Repository Link") [api](https://cosmos-backend-2b614852.fastapicloud.dev/docs#/default/health_check_health_get "API Doc") [live](https://cosmos-ai-powerd-intelligent-tutori.vercel.app/ "Live")',
          bullets: [
            "Architected an **AI-powered tutoring platform** for UIU to enable **RAG-based queries** across institutional question banks, course materials, and academic resources via a **LangGraph-orchestrated agentic workflow** using **LangChain** and **Python**.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Multi-Tenant SaaS E-commerce Platform** | *.NET Microservices | CQRS | PostgreSQL | Redis*",
          right:
            '[repo](https://github.com/KamrulIslamArnob/Dukan-multi-tenant-saas-ecommerce-platform "Repository Link") [live](https://www.arnob.codes/projects/dukan "Architecture")',
          bullets: [
            "Engineered a **multi-tenant e-commerce platform** using **3 .NET microservices** adhering to the **CQRS pattern**, handling merchant store onboarding, catalog/inventory management, checkout workflows, and administrative oversight. Integrated real-time **SignalR push notifications**, automated **email dispatch**, **MinIO object storage**, automated **WebP image optimization**, and **Redis caching** over **PostgreSQL**.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Fera : Rehab Center Management System** | *Next.js | TypeScript | Firebase*",
          right: '[live](https://rehab-center-management-system.vercel.app/login "Live")',
          bullets: [
            "Built production **ERP software** for rehab center operations, actively deployed across **3 facilities** with **~90 daily staff users** running core operational workflows; self-taught **Next.js** and **Firebase Firestore** directly from official docs with no prior production experience.",
          ],
        },
      ],
    },

    education: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left1: "United International University (UIU)",
          right1: "CGPA: 3.66/4.00",
          left2: "B.Sc. in Computer Science & Engineering; Data Science (Major)",
          right2: "Feb 2022 – May 2026",
          bullets: [
            "Achieved **5x 50%** & **7x 25%** result-based scholarships.",
            "**2x Winner of 'CSE Project Show'.**",
          ],
        },
        {
          id: crypto.randomUUID(),
          left1: "Birshreshtha Munshi Abdur Rouf Public College",
          right1: "GPA: 5.00/5.00",
          left2: "Higher Secondary School Certificate (Science)",
          right2: "Apr 2018 – Dec 2020",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left1: "Government Laboratory High School",
          right1: "GPA: 5.00/5.00",
          left2: "Secondary School Certificate (Science)",
          right2: "Feb 2008 – Jan 2018",
          bullets: [],
        },
      ],
    },

    training: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: '[cred](https://drive.google.com/file/d/1Xit40VQszZoJqjJFVxu72qZ07UDrNf0U/view?usp=sharing "Credentials") **Enterprise .NET & Microservices Architecture Program**',
          right: "",
          bullets: [],
          note:
            "Demonstrated proficiency in ASP.NET Core, Entity Framework Core, ADO.NET, Clean Architecture, MediatR, SignalR, Microservices, Redis, Kafka, Elasticsearch, Docker, CI/CD & Deployment, and Unit & Integration Testing.",
        },
      ],
    },

    awards: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: '[cred](https://www.linkedin.com/posts/kamrulislamarnob_i-missed-most-hackathons-during-my-university-activity-7418303421549662208-_Vkv "Credentials") **"Best Code Quality" Award at UIU Hackday 2026** | *United International University*',
          right: "2026",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://www.linkedin.com/posts/kamrulislamarnob_system-analysis-design-lab-summer-share-7293666500702310400-U7GY/ "Credentials") **1st Runner Up in Software Engineering Lab** | *United International University*',
          right: "2024",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://www.linkedin.com/posts/kamrulislamarnob_through-the-whirlwind-of-a-demanding-semester-ugcPost-7250035070525157376-BJLt/ "Credentials") **Champion at the System Analysis & Design Laboratory** | *United International University*',
          right: "2023",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://www.linkedin.com/posts/kamrulislamarnob_programming-uiuappforum-activity-7007337589649154048-Vb-M "Credentials") **1st Runner-Up in Programming for Beginners** | *United International University*',
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
          left: '[cred](https://www.coursera.org/account/accomplishments/verify/Z7LWGBXLZQMH "Credentials") **Supervised Machine Learning: Regression and Classification** | *DeepLearning.AI*',
          right: "May 2024",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://ostad.app/share/certificate/c17328-kamrul-islam-arnob "Credentials") **Web Development with PHP & Laravel** | *Ostad*',
          right: "Mar 2024",
          bullets: [],
        },
        {
          id: crypto.randomUUID(),
          left: '[cred](https://www.udemy.com/certificate/UC-1eb6d865-1197-417b-b827-97969611112f/ "Credentials") **Learn Coding with Java from Scratch: Essential Training 2023** | *Udemy*',
          right: "Dec 2022",
          bullets: [],
        },
      ],
    },

    leadership: {
      visible: true,
      entries: [
        {
          id: crypto.randomUUID(),
          left: "**UIU App Forum** | *Coordinator of Student Development & Innovation Hub*",
          right: "Jun 2022 – Nov 2025",
          bullets: [
            "Advanced through **4 progressive roles** over 3.5 years to oversee the Software, Student Development, and Data Science departments.",
            "Transitioned from General Secretary to coordinating the Student Development section, aligning operations with student needs and institutional objectives to foster **campus-wide tech innovation**.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Science Club of Rouf College** | *Advisor & Former General Secretary*",
          right: "Nov 2019 – Present",
          bullets: [
            "Progressed through **3 executive roles** over 5+ years, currently serving as a strategic Advisor overseeing core team operations.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**BASIS Students' Forum UIU Chapter** | *Co-Convener*",
          right: "Dec 2023 – Jan 2025",
          bullets: [
            "Served as a **primary liaison**, bridging communication and initiatives between UIU students and the national BASIS chapter.",
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**UIU Finance Forum** | *Co-Head of Design*",
          right: "Mar 2023 – Aug 2024",
          bullets: [
            '[cred](https://drive.google.com/file/d/1RRz0a9WwbuWtrfvbVl_IywGZEeFOaQSC/view "Credentials") Co-led visual branding and creative direction for the Microsoft-authorized event, **"The Excelist 2022"**',
          ],
        },
        {
          id: crypto.randomUUID(),
          left: "**Science Club of Laboratorians** | *Strategic Coordinator*",
          right: "Apr 2019 – Jan 2020",
          bullets: [
            "Founded and coordinated a targeted program to promote **financial literacy** among underprivileged high school students.",
          ],
        },
      ],
    },
  };
}
