"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// Type definitions
export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[]; // Optional array of MCP server tools
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level: number;
  dependencies: string[];
  subtasks: Subtask[];
}

interface AgentPlanProps {
  tasks?: Task[];
  onTaskUpdate?: (taskId: string, status: string) => void;
  onSubtaskUpdate?: (taskId: string, subtaskId: string, status: string) => void;
  compact?: boolean;
  className?: string;
}

// Initial task data for demo purposes
const initialTasks: Task[] = [
  {
    id: "1",
    title: "Research Project Requirements",
    description: "Gather all necessary information about project scope and requirements",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "1.1",
        title: "Interview stakeholders",
        description: "Conduct interviews with key stakeholders to understand needs",
        status: "completed",
        priority: "high",
        tools: ["communication-agent", "meeting-scheduler"],
      },
      {
        id: "1.2",
        title: "Review existing documentation",
        description: "Go through all available documentation and extract requirements",
        status: "in-progress",
        priority: "medium",
        tools: ["file-system", "browser"],
      },
      {
        id: "1.3",
        title: "Compile findings report",
        description: "Create a comprehensive report of all gathered information",
        status: "need-help",
        priority: "medium",
        tools: ["file-system", "markdown-processor"],
      },
    ],
  },
];

export default function AgentPlan({ 
  tasks: propTasks, 
  onTaskUpdate, 
  onSubtaskUpdate,
  compact = false,
  className = ""
}: AgentPlanProps) {
  const [tasks, setTasks] = useState<Task[]>(propTasks || initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<{
    [key: string]: boolean;
  }>({});

  // Update tasks when props change
  React.useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      // Auto-expand tasks that are in progress
      const inProgressTasks = propTasks
        .filter(t => t.status === "in-progress")
        .map(t => t.id);
      setExpandedTasks(prev => [...new Set([...prev, ...inProgressTasks])]);
    }
  }, [propTasks]);

  // Add support for reduced motion preference
  const prefersReducedMotion = 
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

  // Toggle task expansion
  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  // Toggle subtask expansion
  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Toggle task status
  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          // Toggle the status
          const statuses = ["completed", "in-progress", "pending", "need-help", "failed"];
          const currentIndex = statuses.indexOf(task.status);
          const nextIndex = (currentIndex + 1) % statuses.length;
          const newStatus = statuses[nextIndex];

          // If task is now completed, mark all subtasks as completed
          const updatedSubtasks = task.subtasks.map((subtask) => ({
            ...subtask,
            status: newStatus === "completed" ? "completed" : subtask.status,
          }));

          // Call the update callback if provided
          if (onTaskUpdate) {
            onTaskUpdate(taskId, newStatus);
          }

          return {
            ...task,
            status: newStatus,
            subtasks: updatedSubtasks,
          };
        }
        return task;
      }),
    );
  };

  // Toggle subtask status
  const toggleSubtaskStatus = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const updatedSubtasks = task.subtasks.map((subtask) => {
            if (subtask.id === subtaskId) {
              const newStatus =
                subtask.status === "completed" ? "pending" : "completed";
              
              // Call the update callback if provided
              if (onSubtaskUpdate) {
                onSubtaskUpdate(taskId, subtaskId, newStatus);
              }
              
              return { ...subtask, status: newStatus };
            }
            return subtask;
          });

          // Calculate if task should be auto-completed when all subtasks are done
          const allSubtasksCompleted = updatedSubtasks.every(
            (s) => s.status === "completed",
          );

          const newTaskStatus = allSubtasksCompleted ? "completed" : task.status;
          
          if (allSubtasksCompleted && onTaskUpdate) {
            onTaskUpdate(taskId, newTaskStatus);
          }

          return {
            ...task,
            subtasks: updatedSubtasks,
            status: newTaskStatus,
          };
        }
        return task;
      }),
    );
  };

  // Animation variants with reduced motion support
  const taskVariants = {
    hidden: { 
      opacity: 0, 
      y: prefersReducedMotion ? 0 : -5 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: prefersReducedMotion ? "tween" : "spring", 
        stiffness: 500, 
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -5,
      transition: { duration: 0.15 }
    }
  };

  const subtaskListVariants = {
    hidden: { 
      opacity: 0, 
      height: 0,
      overflow: "hidden" 
    },
    visible: { 
      height: "auto", 
      opacity: 1,
      overflow: "visible",
      transition: { 
        duration: 0.25, 
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren",
        ease: [0.2, 0.65, 0.3, 0.9] // Custom easing curve for Apple-like feel
      }
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden",
      transition: { 
        duration: 0.2,
        ease: [0.2, 0.65, 0.3, 0.9]
      }
    }
  };

  const subtaskVariants = {
    hidden: { 
      opacity: 0, 
      x: prefersReducedMotion ? 0 : -10 
    },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: prefersReducedMotion ? "tween" : "spring", 
        stiffness: 500, 
        damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      transition: { duration: 0.15 }
    }
  };

  const subtaskDetailsVariants = {
    hidden: { 
      opacity: 0, 
      height: 0,
      overflow: "hidden"
    },
    visible: { 
      opacity: 1, 
      height: "auto",
      overflow: "visible",
      transition: { 
        duration: 0.25,
        ease: [0.2, 0.65, 0.3, 0.9]
      }
    }
  };

  // Status badge animation variants
  const statusBadgeVariants = {
    initial: { scale: 1 },
    animate: { 
      scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
      transition: { 
        duration: 0.35,
        ease: [0.34, 1.56, 0.64, 1] // Springy custom easing for bounce effect
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />;
      case "in-progress":
        return <CircleDotDashed className="h-4.5 w-4.5 text-blue-500" />;
      case "need-help":
        return <CircleAlert className="h-4.5 w-4.5 text-yellow-500" />;
      case "failed":
        return <CircleX className="h-4.5 w-4.5 text-red-500" />;
      default:
        return <Circle className="text-muted-foreground h-4.5 w-4.5" />;
    }
  };

  const getSubtaskStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "in-progress":
        return <CircleDotDashed className="h-3.5 w-3.5 text-blue-500" />;
      case "need-help":
        return <CircleAlert className="h-3.5 w-3.5 text-yellow-500" />;
      case "failed":
        return <CircleX className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Circle className="text-muted-foreground h-3.5 w-3.5" />;
    }
  };

  const getStatusClassName = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "in-progress":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "need-help":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className={`bg-background text-foreground ${compact ? 'w-full' : 'h-full'} overflow-auto ${compact ? 'p-0' : 'p-2'} ${className}`}>
      <motion.div
        className="bg-card border-border rounded-lg border shadow overflow-hidden w-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.3,
            ease: [0.2, 0.65, 0.3, 0.9],
          },
        }}
      >
        <LayoutGroup>
          <div className={`${compact ? "p-2 sm:p-3" : "p-3 sm:p-4"} overflow-hidden`}>
            <ul className="space-y-1 overflow-hidden list-none">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li
                    key={task.id}
                    className={`${index !== 0 ? "mt-1 pt-2" : ""}`}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    {/* Task content wrapper */}
                    <div>
                      {/* Task row */}
                      <motion.div
                        className="group flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md cursor-pointer"
                        onClick={() => toggleTaskExpansion(task.id)}
                        whileHover={{
                          backgroundColor: "rgba(0,0,0,0.03)",
                          transition: { duration: 0.2 },
                        }}
                      >
                        <motion.button
                          className="mr-2 flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task.id);
                          }}
                          whileTap={{ scale: 0.9 }}
                          whileHover={{ scale: 1.1 }}
                          aria-label={`Toggle task ${task.title} status`}
                        >
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={task.status}
                              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                              transition={{
                                duration: 0.2,
                                ease: [0.2, 0.65, 0.3, 0.9],
                              }}
                            >
                              {getStatusIcon(task.status)}
                            </motion.div>
                          </AnimatePresence>
                        </motion.button>

                        <div className="flex min-w-0 flex-grow items-center justify-between gap-2">
                          <div className="mr-2 flex-1 min-w-0">
                            <span className={`${isCompleted ? "text-muted-foreground line-through" : ""} ${compact ? "text-xs sm:text-sm" : "text-sm"} break-words`}>
                              {task.title}
                            </span>
                          </div>

                          <div className="flex flex-shrink-0 items-center space-x-1 sm:space-x-2 text-xs">
                            {task.dependencies.length > 0 && (
                              <div className="hidden sm:flex items-center mr-2">
                                <div className="flex flex-wrap gap-1">
                                  {task.dependencies.map((dep, idx) => (
                                    <motion.span
                                      key={idx}
                                      className="bg-secondary/40 text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{
                                        duration: 0.2,
                                        delay: idx * 0.05
                                      }}
                                      whileHover={{
                                        y: -1,
                                        backgroundColor: "rgba(0,0,0,0.1)",
                                        transition: { duration: 0.2 }
                                      }}
                                    >
                                      {dep}
                                    </motion.span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <motion.span
                              className={`rounded px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs ${getStatusClassName(task.status)}`}
                              variants={statusBadgeVariants}
                              initial="initial"
                              animate="animate"
                              key={task.status} // Force animation on status change
                            >
                              {compact && task.status === 'in-progress' ? 'in-prog' : task.status}
                            </motion.span>
                          </div>
                        </div>
                      </motion.div>

                      {/* Subtasks section */}
                      {isExpanded && task.subtasks.length > 0 && (
                        <AnimatePresence mode="wait">
                          <motion.div
                            className="relative overflow-hidden"
                            variants={subtaskListVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            layout
                          >
                            {/* Vertical connecting line aligned with task icon */}
                            <div className="absolute top-0 bottom-0 left-[16px] sm:left-[20px] border-l-2 border-dashed border-muted-foreground/30" />
                            <ul className="border-muted mt-1 mr-2 mb-1.5 ml-3 space-y-0.5 list-none">
                              {task.subtasks.map((subtask) => {
                                const subtaskKey = `${task.id}-${subtask.id}`;
                                const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                                return (
                                  <motion.li
                                    key={subtask.id}
                                    className="group py-0.5 pl-6"
                                    variants={subtaskVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    layout
                                  >
                                    <div>
                                      <motion.div
                                        className="flex flex-1 items-center rounded-md p-1 cursor-pointer"
                                        onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                        whileHover={{
                                          backgroundColor: "rgba(0,0,0,0.03)",
                                          transition: { duration: 0.2 },
                                        }}
                                        layout
                                      >
                                        <motion.button
                                          className="mr-2 flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSubtaskStatus(task.id, subtask.id);
                                          }}
                                          whileTap={{ scale: 0.9 }}
                                          whileHover={{ scale: 1.1 }}
                                          layout
                                          aria-label={`Toggle subtask ${subtask.title} status`}
                                        >
                                          <AnimatePresence mode="wait">
                                            <motion.div
                                              key={subtask.status}
                                              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                              transition={{
                                                duration: 0.2,
                                                ease: [0.2, 0.65, 0.3, 0.9],
                                              }}
                                            >
                                              {getSubtaskStatusIcon(subtask.status)}
                                            </motion.div>
                                          </AnimatePresence>
                                        </motion.button>

                                        <span
                                          className={`cursor-pointer text-xs sm:text-sm ${subtask.status === "completed" ? "text-muted-foreground line-through" : ""} break-words`}
                                        >
                                          {subtask.title}
                                        </span>
                                      </motion.div>

                                      <AnimatePresence mode="wait">
                                        {isSubtaskExpanded && (
                                          <motion.div
                                            className="text-muted-foreground border-foreground/20 mt-1 ml-1.5 border-l border-dashed pl-5 text-xs overflow-hidden"
                                            variants={subtaskDetailsVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="hidden"
                                            layout
                                          >
                                            <p className="py-1">{subtask.description}</p>
                                            {subtask.tools && subtask.tools.length > 0 && (
                                              <div className="mt-0.5 mb-1 flex flex-wrap items-center gap-1.5">
                                                <span className="text-muted-foreground font-medium">MCP Servers:</span>
                                                <div className="flex flex-wrap gap-1">
                                                  {subtask.tools.map((tool, idx) => (
                                                    <motion.span
                                                      key={idx}
                                                      className="bg-secondary/40 text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
                                                      initial={{ opacity: 0, y: -5 }}
                                                      animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                        transition: {
                                                          duration: 0.2,
                                                          delay: idx * 0.05,
                                                        },
                                                      }}
                                                      whileHover={{
                                                        y: -1,
                                                        backgroundColor: "rgba(0,0,0,0.1)",
                                                        transition: { duration: 0.2 },
                                                      }}
                                                    >
                                                      {tool}
                                                    </motion.span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </motion.li>
                                );
                              })}
                            </ul>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}