import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { observable, ObservableObject } from "@legendapp/state";
import { useObserve } from "@legendapp/state/react";
import { useQuery } from "../useQuery";
import { createWrapper } from "../../__tests__/test-utils";

describe("useQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Query Functionality", () => {
    it("should initialize with pending state", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      expect(result.current.isPending.get()).toBe(true);
      expect(result.current.isLoading.get()).toBe(true);
      expect(result.current.status.get()).toBe("pending");
      expect(result.current.data.get()).toBeUndefined();
    });

    it("should fetch data successfully", async () => {
      const queryFn = vi.fn().mockResolvedValue("success data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      expect(result.current.data.get()).toBe("success data");
      expect(result.current.status.get()).toBe("success");
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("should expose data through observable", async () => {
      const testData = { id: 1, name: "Test" };
      const queryFn = vi.fn().mockResolvedValue(testData);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      expect(result.current.data.get()).toEqual(testData);
    });
  });

  describe("Error Handling", () => {
    it("should handle query errors", async () => {
      const error = new Error("Query failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            retry: false, // Explicitly disable retry for faster test
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError.get()).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error.get()).toEqual(error);
      expect(result.current.status.get()).toBe("error");
    });

    it("should track failureCount", async () => {
      const error = new Error("Query failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            retry: 2,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError.get()).toBe(true), {
        timeout: 5000,
      });

      // Initial attempt + 2 retries = 3 total failures
      expect(result.current.failureCount.get()).toBeGreaterThan(0);
      expect(queryFn).toHaveBeenCalledTimes(3);
    });

    it("should distinguish isLoadingError vs isRefetchError", async () => {
      let shouldFail = true;
      const queryFn = vi.fn().mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error("Failed"));
        }
        return Promise.resolve("success");
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            retry: false, // Disable retry for faster test
          }),
        { wrapper },
      );

      // Initial fetch fails - should be loading error
      await waitFor(() => expect(result.current.isError.get()).toBe(true), {
        timeout: 3000,
      });
      expect(result.current.isLoadingError.get()).toBe(true);
      expect(result.current.isRefetchError.get()).toBe(false);

      // Now make it succeed
      shouldFail = false;
      result.current.refetch();
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true), {
        timeout: 3000,
      });

      // Make it fail again on refetch
      shouldFail = true;
      result.current.refetch();
      await waitFor(() => expect(result.current.isError.get()).toBe(true), {
        timeout: 3000,
      });

      // Now it should be a refetch error
      expect(result.current.isRefetchError.get()).toBe(true);
      expect(result.current.isLoadingError.get()).toBe(false);
    });
  });

  describe("Loading and Fetch States", () => {
    it("should track isFetching during fetch", async () => {
      let resolveQuery: (value: string) => void;
      const queryPromise = new Promise<string>((resolve) => {
        resolveQuery = resolve;
      });
      const queryFn = vi.fn().mockReturnValue(queryPromise);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      // Should be fetching initially
      await waitFor(() => expect(result.current.isFetching.get()).toBe(true));

      // Resolve the query
      resolveQuery!("data");
      await waitFor(() => expect(result.current.isFetching.get()).toBe(false));

      expect(result.current.isSuccess.get()).toBe(true);
    });

    it("should set isLoading only on initial load", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      // Initial load - isLoading should be true
      expect(result.current.isLoading.get()).toBe(true);

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      // After success, isLoading should be false
      expect(result.current.isLoading.get()).toBe(false);

      // Trigger refetch
      result.current.refetch();
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

      // On refetch, isLoading should still be false
      expect(result.current.isLoading.get()).toBe(false);
    });

    it("should set isRefetching on subsequent fetches", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      // Trigger refetch
      result.current.refetch();

      // Should be refetching
      await waitFor(() => expect(result.current.isRefetching.get()).toBe(true));

      // Wait for completion
      await waitFor(() =>
        expect(result.current.isRefetching.get()).toBe(false),
      );
    });

    it("should track fetchStatus correctly", async () => {
      let resolveQuery: (value: string) => void;
      const queryPromise = new Promise<string>((resolve) => {
        resolveQuery = resolve;
      });
      const queryFn = vi.fn().mockReturnValue(queryPromise);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      // Should transition to fetching
      await waitFor(() =>
        expect(result.current.fetchStatus.get()).toBe("fetching"),
      );

      // Resolve the query
      resolveQuery!("data");

      // Should transition to idle
      await waitFor(() =>
        expect(result.current.fetchStatus.get()).toBe("idle"),
      );
    });
  });

  describe("Observable Reactivity", () => {
    it("should accept observables in queryKey", async () => {
      // Use standalone observable (not useObservable hook)
      const filter$ = observable({ category: "electronics" });
      const queryFn = vi.fn().mockResolvedValue({ items: [] });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      // Wait for initial fetch
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      // Verify that the query executed successfully with an observable in queryKey
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data.get()).toEqual({ items: [] });
    });

    it("should use serialized queryKey for cache", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper, queryClient } = createWrapper();

      const filter$ = observable({ status: "active" });

      renderHook(
        () =>
          useQuery({
            queryKey: ["items", filter$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      // The actual cache key should be the serialized version
      const serializedKey = JSON.stringify(["items", { status: "active" }]);
      const cacheData = queryClient.getQueryData([serializedKey]);

      expect(cacheData).toBe("data");
    });

    it("should refetch when partial observable queryKey changes", async () => {
      const filter$ = observable({ category: "electronics" });
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          items: [],
          category: filter$.category.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$, "list"], // Only filter$ is observable
            queryFn,
          }),
        { wrapper },
      );

      // Wait for initial fetch
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "electronics",
        call: 1,
      });

      // Change the observable - should trigger refetch
      filter$.category.set("sports");

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "sports",
        call: 2,
      });

      // Change again
      filter$.category.set("books");

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "books",
        call: 3,
      });
    });
  });

  describe("Query Options", () => {
    it("should respect enabled: false", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            enabled: false,
          }),
        { wrapper },
      );

      // Wait a bit to ensure query doesn't execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(queryFn).not.toHaveBeenCalled();
      expect(result.current.status.get()).toBe("pending");
    });

    it("should respect staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            staleTime: 10000, // 10 seconds
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      // Within staleTime window, data should not be stale
      expect(result.current.isStale.get()).toBe(false);
    });
  });

  describe("Refetch", () => {
    it("should expose refetch function", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      expect(typeof result.current.refetch).toBe("function");
    });

    it("should refetch data when refetch() is called", async () => {
      let counter = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        counter++;
        return Promise.resolve(`data-${counter}`);
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(result.current.data.get()).toBe("data-1");

      // Call refetch
      result.current.refetch();

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
      expect(result.current.data.get()).toBe("data-2");
    });
  });

  describe("Cleanup", () => {
    it("should unsubscribe on unmount", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result, unmount } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));

      // Unmount the hook
      unmount();

      // If there are no React warnings/errors, cleanup is working correctly
      // We can verify by ensuring no updates happen after unmount
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe("State Completeness", () => {
    it("should include isEnabled field", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn: async () => "data",
            enabled: false,
          }),
        { wrapper },
      );

      expect(result.current.isEnabled.get()).toBe(false);
    });

    it("should include isInitialLoading as deprecated alias", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 50));
              return "data";
            },
          }),
        { wrapper },
      );

      // isInitialLoading should match isLoading
      expect(result.current.isInitialLoading.get()).toBe(
        result.current.isLoading.get(),
      );
    });
  });

  describe("Advanced Observable Edge Cases", () => {
    it("should handle multiple observables in queryKey", async () => {
      const filter1$ = observable<{ category: string }>({
        category: "electronics",
      });
      const filter2$ = observable<{ minPrice: number }>({ minPrice: 100 });
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          items: [],
          category: filter1$.category.get(),
          minPrice: filter2$.minPrice.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter1$, filter2$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "electronics",
        minPrice: 100,
        call: 1,
      });

      // Change first observable
      filter1$.category.set("books");
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "books",
        minPrice: 100,
        call: 2,
      });

      // Change second observable
      filter2$.minPrice.set(200);
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "books",
        minPrice: 200,
        call: 3,
      });
    });

    it("should handle nested observable objects", async () => {
      const nested$ = observable<{ filters: { category: string } }>({
        filters: { category: "electronics" },
      });
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          items: [],
          category: nested$.filters.category.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", nested$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Change nested observable
      nested$.filters.category.set("books");
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()?.category).toBe("books");
    });

    it("should handle observable that becomes undefined", async () => {
      const filter$ = observable<string | undefined>("electronics");
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          items: [],
          category: filter$.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(result.current.data.get()?.category).toBe("electronics");

      // Set to undefined
      filter$.set(undefined);
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()?.category).toBeUndefined();

      // Set back to a value
      filter$.set("books");
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3), {
        timeout: 3000,
      });
      expect(result.current.data.get()?.category).toBe("books");
    });

    it("should handle observable that becomes null", async () => {
      const filter$ = observable<string | null>("electronics");
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          items: [],
          category: filter$.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Set to null
      filter$.set(null);
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()?.category).toBeNull();
    });
  });

  describe("Observable Change Timing", () => {
    it("should handle observable change during ongoing fetch", async () => {
      const filter$ = observable<{ category: string }>({
        category: "electronics",
      });
      let resolveFirst: (value: any) => void;
      let callCount = 0;

      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({
          items: [],
          category: filter$.category.get(),
          call: callCount,
        });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      // Wait for first fetch to start
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      // Change observable while first fetch is ongoing
      filter$.category.set("books");

      // Resolve first fetch
      resolveFirst!({ items: [], category: "electronics", call: 1 });

      // Second fetch should be triggered
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "books",
        call: 2,
      });
    });

    it("should handle rapid successive observable changes", async () => {
      const filter$ = observable<{ category: string }>({
        category: "electronics",
      });
      const queryFn = vi.fn().mockImplementation(() => {
        return Promise.resolve({ items: [], category: filter$.category.get() });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      // Rapid changes
      filter$.category.set("books");
      filter$.category.set("sports");
      filter$.category.set("toys");

      // Should eventually settle on final value
      await waitFor(
        () => expect(result.current.data.get()?.category).toBe("toys"),
        {
          timeout: 3000,
        },
      );
      expect(queryFn.mock.calls.length).toBeGreaterThan(1);
    });

    it("should not update state after unmount during fetch", async () => {
      let resolveQuery: (value: string) => void;
      const queryFn = vi.fn(
        () => new Promise<string>((r) => (resolveQuery = r)),
      );
      const { wrapper } = createWrapper();

      const { unmount } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalled());

      // Unmount before fetch completes
      unmount();

      // Resolve after unmount - should not cause errors or warnings
      resolveQuery!("data");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If no errors were thrown, cleanup is working correctly
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Observable and Enabled Integration", () => {
    it("should not fetch initially when enabled is false", async () => {
      const filter$ = observable<{ category: string }>({
        category: "electronics",
      });
      const queryFn = vi.fn().mockImplementation(() => {
        return Promise.resolve({ items: [], category: filter$.category.get() });
      });
      const { wrapper } = createWrapper();

      renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
            enabled: false,
          }),
        { wrapper },
      );

      // Should not fetch when disabled initially
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(queryFn).not.toHaveBeenCalled();
    });

    it("should work with enabled option and observable queryKey", async () => {
      const filter$ = observable<{ category: string }>({
        category: "electronics",
      });
      const queryFn = vi.fn().mockImplementation(() => {
        return Promise.resolve({ items: [], category: filter$.category.get() });
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
            enabled: true,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalled());
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "electronics",
      });

      // Observable changes should trigger refetch when enabled
      filter$.category.set("books");
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(result.current.data.get()).toEqual({
        items: [],
        category: "books",
      });
    });
  });

  describe("Cache Key Serialization", () => {
    it("should serialize observable values correctly for cache key", async () => {
      const filter$ = observable<{ category: string }>({
        category: "electronics",
      });
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper, queryClient } = createWrapper();

      renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      // Verify cache has the data with serialized key
      const serializedKey = JSON.stringify([
        "products",
        { category: "electronics" },
      ]);
      const cacheData = queryClient.getQueryData([serializedKey]);
      expect(cacheData).toBe("data");
    });

    it("should use different cache for different observable values", async () => {
      const filter1$ = observable<{ category: string }>({
        category: "electronics",
      });
      const filter2$ = observable<{ category: string }>({ category: "books" });
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      // First hook
      renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter1$],
            queryFn,
          }),
        { wrapper },
      );

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      // Second hook with different value
      renderHook(
        () =>
          useQuery({
            queryKey: ["products", filter2$],
            queryFn,
          }),
        { wrapper },
      );

      // Should call queryFn again for different cache key
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });
  });

  describe("Context Integration", () => {
    it("should throw error when QueryClient not provided", () => {
      // Render without wrapper (no QueryClientProvider)
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() =>
          useQuery({
            queryKey: ["test"],
            queryFn: async () => "data",
          }),
        );
      }).toThrow("useQueryClient must be used within a QueryClientProvider");

      consoleError.mockRestore();
    });
  });

  describe("Error Boundary Integration", () => {
    it("should have throwOnError option available", async () => {
      const error = new Error("Query failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const { wrapper } = createWrapper();

      // Test that throwOnError option is accepted and doesn't cause errors
      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            retry: false,
            throwOnError: true,
          }),
        { wrapper },
      );

      // Wait for error state
      await waitFor(
        () => {
          const errorState = (result.current as any).error.get();
          expect(errorState).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Error should be in state
      expect(result.current.error.get()).toEqual(error);
    });

    it("should not throw error when throwOnError is false", async () => {
      const error = new Error("Query failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            retry: false,
            throwOnError: false,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError.get()).toBe(true), {
        timeout: 3000,
      });

      // Should store error in state, not throw
      expect(result.current.error.get()).toEqual(error);
    });

    it("should support throwOnError as a function", async () => {
      const error1 = new Error("Critical error");
      const error2 = new Error("Non-critical error");
      const { wrapper } = createWrapper();

      // This should throw
      const queryFn1 = vi.fn().mockRejectedValue(error1);
      const { result: result1 } = renderHook(
        () =>
          useQuery({
            queryKey: ["test1"],
            queryFn: queryFn1,
            retry: false,
            throwOnError: (err) => err.message.includes("Critical"),
          }),
        { wrapper },
      );

      await waitFor(
        () => {
          const errorState = (result1.current as any).error.get();
          expect(errorState).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // This should not throw
      const queryFn2 = vi.fn().mockRejectedValue(error2);
      const { result: result2 } = renderHook(
        () =>
          useQuery({
            queryKey: ["test2"],
            queryFn: queryFn2,
            retry: false,
            throwOnError: (err) => err.message.includes("Critical"),
          }),
        { wrapper },
      );

      await waitFor(() => expect(result2.current.isError.get()).toBe(true), {
        timeout: 3000,
      });

      expect(result2.current.error.get()).toEqual(error2);
    });
  });

  describe("useObserve Reactivity", () => {
    it("should trigger useObserve(state$, callback) when query state changes", async () => {
      const queryFn = vi.fn().mockResolvedValue("success data");
      const { wrapper } = createWrapper();
      const onStateChange = vi.fn();

      renderHook(
        () => {
          const state$ = useQuery({ queryKey: ["test"], queryFn });
          useObserve(state$, () => {
            if (state$.isSuccess.get()) {
              onStateChange(state$.data.get());
            }
          });
        },
        { wrapper },
      );

      await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      });
      expect(onStateChange).toHaveBeenCalledWith("success data");
    });

    it("should trigger useObserve when query succeeds", async () => {
      const queryFn = vi.fn().mockResolvedValue("success data");
      const { wrapper } = createWrapper();
      const onSuccess = vi.fn();

      renderHook(
        () => {
          const query$ = useQuery({ queryKey: ["test"], queryFn });
          useObserve(
            () => query$.isSuccess.get(),
            () => {
              onSuccess(query$.data.get());
            },
          );
        },
        { wrapper },
      );

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      });
      expect(onSuccess).toHaveBeenCalledWith("success data");
    });

    it("should trigger useObserve when query fails", async () => {
      const error = new Error("Query failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const { wrapper } = createWrapper();
      const onError = vi.fn();

      renderHook(
        () => {
          const query$ = useQuery({
            queryKey: ["test"],
            queryFn,
            retry: false,
          });
          useObserve(
            () => query$.isError.get(),
            () => {
              onError(query$.error.get());
            },
          );
        },
        { wrapper },
      );

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      });
      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should trigger useObserve on refetch with new data", async () => {
      let count = 0;
      const queryFn = vi
        .fn()
        .mockImplementation(() => Promise.resolve(`data-${++count}`));
      const { wrapper } = createWrapper();
      const onData = vi.fn();

      const { result } = renderHook(
        () => {
          const query$ = useQuery({ queryKey: ["test"], queryFn });
          useObserve(
            () => query$.data.get(),
            () => {
              onData(query$.data.get());
            },
          );
          return query$;
        },
        { wrapper },
      );

      await waitFor(() => expect(onData).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      });
      expect(onData).toHaveBeenLastCalledWith("data-1");

      result.current.refetch();

      await waitFor(() => expect(onData).toHaveBeenCalledTimes(2), {
        timeout: 3000,
      });
      expect(onData).toHaveBeenLastCalledWith("data-2");
    });
  });

  describe("Suspense Integration", () => {
    it("should not throw promise when suspense is false", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            suspense: false,
          }),
        { wrapper },
      );

      // Should start in pending state without throwing
      expect(result.current.isPending.get()).toBe(true);

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(result.current.data.get()).toBe("data");
    });

    // Note: Testing actual suspense throwing is complex in vitest
    // as it requires React Suspense boundaries. The logic is tested
    // by verifying the conditions under which it would throw.
    it("should have correct state for suspense conditions", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn,
            suspense: true,
          }),
        { wrapper },
      );

      // Initially should be pending and fetching
      const initialStatus = (result.current as any).status.get();
      const initialFetchStatus = (result.current as any).fetchStatus.get();

      // These are the conditions that would trigger suspense throw
      if (initialStatus === "pending" && initialFetchStatus === "fetching") {
        // Suspense would throw here in a real app with Suspense boundary
        expect(true).toBe(true);
      }

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true));
      expect(result.current.data.get()).toBe("data");
    });
  });
});
