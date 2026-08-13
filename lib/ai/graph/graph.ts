import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatStateAnnotation } from "./state";
import { loadContextNode, retrieveContextNode, toolExecutorNode, generateNode, finalizeNode } from "./nodes";

const workflow = new StateGraph(ChatStateAnnotation)
  .addNode("loadContext", loadContextNode)
  .addNode("retrieveContext", retrieveContextNode)
  .addNode("toolExecutor", toolExecutorNode)
  .addNode("generate", generateNode)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "loadContext")
  .addEdge("loadContext", "retrieveContext")
  .addEdge("retrieveContext", "toolExecutor")
  .addEdge("toolExecutor", "generate")
  .addEdge("generate", "finalize")
  .addEdge("finalize", END);

export const chatGraph = workflow.compile();
