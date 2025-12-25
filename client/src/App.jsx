import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";

const GET_QUESTIONS = gql`
  query GetQuestions {
    questions {
      id
      title
      options {
        id
        votes
      }
    }
  }
`;

const GET_QUESTION = gql`
  query GetQuestion($id: ID!) {
    question(id: $id) {
      id
      title
      options {
        id
        title
        votes
      }
    }
  }
`;

const CREATE_QUESTION_MUTATION = gql`
  mutation CreateQuestion($title: String!, $options: [String!]!) {
    createQuestion(title: $title, options: $options) {
      id
      title
      options {
        id
        votes
      }
    }
  }
`;

const VOTE_MUTATION = gql`
  mutation Vote($optionId: ID!) {
    vote(optionId: $optionId) {
      id
      title
      options {
        id
        votes
      }
    }
  }
`;

const QUESTION_CREATED_SUBSCRIPTION = gql`
  subscription OnQuestionCreated {
    questionCreated {
      id
      title
      options {
        id
        votes
      }
    }
  }
`;

const VOTE_UPDATED_SUBSCRIPTION = gql`
  subscription OnVoteUpdated {
    voteUpdated {
      id
      title
      options {
        id
        title
        votes
      }
    }
  }
`;

const Layout = ({ children }) => (
  <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
        >
          Realtime Voting
        </Link>
        <Link
          to="/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-sm active:scale-95"
        >
          Yeni Soru Sor
        </Link>
      </div>
    </nav>
    <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
  </div>
);

const Home = () => {
  const { loading, error, data, subscribeToMore } = useQuery(GET_QUESTIONS, {
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: QUESTION_CREATED_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        const newQuestion = subscriptionData.data.questionCreated;
        if (prev.questions.find((q) => q.id === newQuestion.id)) return prev;
        return {
          ...prev,
          questions: [newQuestion, ...prev.questions],
        };
      },
    });
    return () => unsubscribe();
  }, [subscribeToMore]);

  if (loading)
    return <div className="text-center py-10">Sorular yükleniyor...</div>;
  if (error) return <div className="text-red-500">Hata: {error.message}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
        Aktif Oylamalar
      </h1>
      <div className="grid gap-4 md:grid-cols-2">
        {data.questions.map((q) => (
          <Link
            key={q.id}
            to={`/question/${q.id}`}
            className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all"
          >
            <h3 className="text-xl font-bold mb-3 group-hover:text-blue-600">
              {q.title}
            </h3>
            <div className="flex items-center text-slate-400 text-sm font-medium">
              <span className="bg-slate-100 px-2 py-1 rounded-md mr-2 text-slate-600">
                {q.options.reduce((acc, curr) => acc + curr.votes, 0)} oy
              </span>
              <span>• Canlı</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const NewQuestion = () => {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const navigate = useNavigate();
  const [createQuestion, { loading }] = useMutation(CREATE_QUESTION_MUTATION, {
    refetchQueries: [{ query: GET_QUESTIONS }],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createQuestion({
        variables: {
          title,
          options: options.filter((opt) => opt.trim() !== ""),
        },
      });
      navigate("/");
    } catch {
      alert("Hata oluştu!");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-8">Yeni Oylama Başlat</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            required
            className="w-full p-4 border border-slate-200 rounded-xl outline-none bg-slate-50"
            placeholder="Soru başlığı..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {options.map((opt, i) => (
            <input
              key={i}
              required
              className="w-full p-3 border border-slate-200 rounded-xl outline-none"
              placeholder={`Seçenek ${i + 1}`}
              value={opt}
              onChange={(e) => {
                const updated = [...options];
                updated[i] = e.target.value;
                setOptions(updated);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="text-blue-600 font-bold text-sm"
          >
            + Seçenek Ekle
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold"
          >
            {loading ? "Oluşturuluyor..." : "Oylamayı Başlat"}
          </button>
        </form>
      </div>
    </div>
  );
};

const QuestionDetail = () => {
  const { id } = useParams();
  const [voted, setVoted] = useState(false);
  const { loading, error, data, subscribeToMore } = useQuery(GET_QUESTION, {
    variables: { id },
  });
  const [voteMutation] = useMutation(VOTE_MUTATION);

  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: VOTE_UPDATED_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        return { question: subscriptionData.data.voteUpdated };
      },
    });
    return () => unsubscribe();
  }, [id, subscribeToMore]);

  if (loading) return <div className="text-center py-10">Yükleniyor...</div>;
  if (error || !data?.question)
    return <div className="text-red-500">Soru bulunamadı.</div>;

  const { title, options } = data.question;
  const totalVotes = options.reduce((acc, curr) => acc + curr.votes, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-8 italic">"{title}"</h2>
        {!voted ? (
          <div className="grid gap-3">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={async () => {
                  await voteMutation({ variables: { optionId: opt.id } });
                  setVoted(true);
                }}
                className="w-full text-left p-5 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 font-semibold transition-all"
              >
                {opt.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
              Canlı Sonuçlar
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs animate-pulse">
                CANLI
              </span>
            </h3>
            {options.map((opt) => {
              const percentage =
                totalVotes > 0
                  ? ((opt.votes / totalVotes) * 100).toFixed(1)
                  : 0;
              return (
                <div key={opt.id} className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>{opt.title}</span>
                    <span>
                      %{percentage} ({opt.votes} oy)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-700 ease-out"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewQuestion />} />
        <Route path="/question/:id" element={<QuestionDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
