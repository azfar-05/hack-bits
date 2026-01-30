"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";

export function TrainingDashboard() {
  const { data: session } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Queries
  const modulesQuery = api.training.getModules.useQuery({
    category: selectedCategory === "all" ? undefined : selectedCategory,
  });

  const myProgressQuery = api.training.getMyProgress.useQuery(undefined, {
    enabled: !!session,
  });

  const statsQuery = api.training.getStats.useQuery(undefined, {
    enabled: !!session,
  });

  const categoriesQuery = api.training.getCategories.useQuery();

  const leaderboardQuery = api.training.getLeaderboard.useQuery({
    limit: 10,
    category: selectedCategory === "all" ? undefined : selectedCategory,
  });

  const moduleQuery = api.training.getModule.useQuery(
    { id: selectedModule! },
    { enabled: !!selectedModule }
  );

  // Mutations
  const startModuleMutation = api.training.startModule.useMutation({
    onSuccess: () => {
      myProgressQuery.refetch();
      statsQuery.refetch();
    },
  });

  const updateProgressMutation = api.training.updateProgress.useMutation({
    onSuccess: () => {
      myProgressQuery.refetch();
      statsQuery.refetch();
    },
  });

  const getProgressForModule = (moduleId: string) => {
    return myProgressQuery.data?.find(p => p.moduleId === moduleId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "BEGINNER": return "bg-green-100 text-green-800";
      case "INTERMEDIATE": return "bg-yellow-100 text-yellow-800";
      case "ADVANCED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
      case "NOT_STARTED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {session && statsQuery.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-blue-600">
              {statsQuery.data.completedModules}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-xs text-gray-500 mt-1">
              {statsQuery.data.completionRate.toFixed(1)}% overall
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-yellow-600">
              {statsQuery.data.inProgressModules}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-green-600">
              {statsQuery.data.requiredCompleted}
            </div>
            <div className="text-sm text-gray-600">Required Done</div>
            <div className="text-xs text-gray-500 mt-1">
              {statsQuery.data.requiredCompletionRate.toFixed(1)}% required
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-purple-600">
              {statsQuery.data.totalModules}
            </div>
            <div className="text-sm text-gray-600">Total Available</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Training Modules */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                Training Modules
              </h2>

              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categoriesQuery.data?.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                >
                  {showLeaderboard ? "Hide" : "Show"} Leaderboard
                </button>
              </div>
            </div>

            {/* Modules List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {modulesQuery.isLoading && (
                <div className="text-center text-gray-500 py-8">Loading modules...</div>
              )}

              {modulesQuery.data?.map((module) => {
                const progress = getProgressForModule(module.id);
                return (
                  <div key={module.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{module.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(module.difficulty)}`}>
                            {module.difficulty.toLowerCase()}
                          </span>
                          {module.isRequired && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                              Required
                            </span>
                          )}
                          {progress && (
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(progress.status)}`}>
                              {progress.status.replace("_", " ").toLowerCase()}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{module.description}</p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{module.duration} minutes</span>
                          <span>Category: {module.category}</span>
                          {progress?.score && (
                            <span>Score: {progress.score}%</span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {progress && progress.progress > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{progress.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setSelectedModule(selectedModule === module.id ? null : module.id)}
                          className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          {selectedModule === module.id ? "Hide" : "View"}
                        </button>

                        {!progress || progress.status === "NOT_STARTED" ? (
                          <button
                            onClick={() => startModuleMutation.mutate({ moduleId: module.id })}
                            disabled={startModuleMutation.isPending}
                            className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                          >
                            Start
                          </button>
                        ) : progress.status === "IN_PROGRESS" ? (
                          <button
                            onClick={() => updateProgressMutation.mutate({ 
                              moduleId: module.id, 
                              progress: 100,
                              score: 85 // Simulate completion with good score
                            })}
                            disabled={updateProgressMutation.isPending}
                            className="text-sm bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                          >
                            Complete
                          </button>
                        ) : (
                          <span className="text-sm text-green-600 px-3 py-1">
                            ✓ Done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Module Content */}
                    {selectedModule === module.id && moduleQuery.data && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-gray-700">
                            {moduleQuery.data.content}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {modulesQuery.data?.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <svg className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="font-medium">No training modules found</p>
                  <p className="text-sm mt-1">Check back later for new training content.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* My Progress */}
          {session && myProgressQuery.data && myProgressQuery.data.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Progress</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {myProgressQuery.data.slice(0, 5).map((progress) => (
                  <div key={progress.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {progress.module.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {progress.progress}% complete
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(progress.status)}`}>
                      {progress.status === "COMPLETED" ? "✓" : progress.status === "IN_PROGRESS" ? "..." : "○"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {showLeaderboard && (
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🏆</span>
                Leaderboard
              </h3>
              
              {leaderboardQuery.isLoading && (
                <div className="text-center text-gray-500 py-4">Loading...</div>
              )}

              <div className="space-y-3">
                {leaderboardQuery.data?.map((user, index) => (
                  <div key={user.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-yellow-400 text-yellow-900" :
                      index === 1 ? "bg-gray-300 text-gray-700" :
                      index === 2 ? "bg-orange-400 text-orange-900" :
                      "bg-gray-200 text-gray-600"
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {user.userName || user.userEmail}
                        {user.userId === session?.user?.id && (
                          <span className="ml-2 text-xs text-blue-600">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {user.userRole.toLowerCase()}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-bold text-purple-600">
                        {user.totalPoints} pts
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.completedModules} modules
                      </div>
                    </div>
                  </div>
                ))}

                {leaderboardQuery.data?.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No rankings yet. Complete some training to appear here!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}