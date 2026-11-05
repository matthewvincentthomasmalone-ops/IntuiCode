defmodule Jobs.Queue do
  @moduledoc """
  A queue of background jobs, kept in a process so several callers can share it.
  """
  use GenServer
  require Logger

  @max_attempts 3

  defstruct pending: [], failed: [], done: 0

  # Client

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, %__MODULE__{}, opts)
  end

  @doc "Adds a job to the end of the queue."
  def push(queue, job) when is_map(job) do
    GenServer.cast(queue, {:push, Map.put_new(job, :attempts, 0)})
  end

  def stats(queue), do: GenServer.call(queue, :stats)

  # Server

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_cast({:push, job}, state) do
    {:noreply, %{state | pending: state.pending ++ [job]}}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    reply = %{pending: length(state.pending), failed: length(state.failed), done: state.done}
    {:reply, reply, state}
  end

  def run_next(%__MODULE__{pending: []} = state), do: state

  def run_next(%__MODULE__{pending: [job | rest]} = state) do
    case perform(job) do
      :ok ->
        %{state | pending: rest, done: state.done + 1}

      {:error, reason} when job.attempts + 1 < @max_attempts ->
        Logger.warning("Job failed: #{inspect(reason)}, trying again")
        %{state | pending: rest ++ [%{job | attempts: job.attempts + 1}]}

      {:error, _reason} ->
        %{state | pending: rest, failed: [job | state.failed]}
    end
  end

  defp perform(%{task: task}) when is_function(task, 0) do
    task.()
    |> case do
      :ok -> :ok
      other -> {:error, other}
    end
  end
end
