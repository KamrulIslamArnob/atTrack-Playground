export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MCQTest {
  jobId: string;
  jobTitle: string;
  company: string;
  questions: MCQQuestion[];
  generatedAt: string;
}
